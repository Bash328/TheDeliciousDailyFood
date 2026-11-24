const fs = require("fs");
const path = require("path");
const site = require("./_data/site.js");
const kitchen = require("./lib/kitchen.js");
const { eleventyImageTransformPlugin } = require("@11ty/eleventy-img");

module.exports = function (eleventyConfig) {
  // Rewrites every built-in <img> tag at build time into a responsive,
  // lazy-loaded <picture> (AVIF/WebP/JPEG) sized off its actual "sizes"
  // attribute — this is what keeps photo pages fast without hand-resizing
  // anything uploaded through /admin.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp", "jpeg"],
    widths: [400, 800, 1200, 1600],
    // The plugin defaults this to true under `eleventy --serve`, resolving
    // images on-request instead of writing them upfront. Its on-request
    // handler has a path-separator bug on Windows (404s every image) —
    // forcing eager generation avoids it and costs only a slower first
    // `npm start`, since every variant is already cached from `npm run build`.
    transformOnRequest: false,
    // Sharp's JPEG/WebP defaults (quality 80) run heavier than this content
    // needs — photos read the same at 75 and the JPEG/WebP fallback tiers
    // (what non-AVIF browsers actually download) shrink meaningfully.
    // Progressive JPEG also paints a low-res pass immediately instead of
    // top-to-bottom, so it *feels* faster on a slow connection even at the
    // same byte count.
    sharpJpegOptions: { quality: 75, progressive: true },
    sharpWebpOptions: { quality: 75 },
    htmlOptions: {
      imgAttributes: {
        loading: "lazy",
        decoding: "async",
      },
    },
  });

  // Strips whitespace/comments from every rendered .html page at build time.
  // The import is resolved once and shared, rather than awaited inside every
  // one of the ~50 page transforms.
  let minifyHtml;
  eleventyConfig.addTransform("htmlmin", async function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html")) {
      if (!minifyHtml) {
        minifyHtml = (await import("html-minifier-terser")).minify;
      }
      return minifyHtml(content, {
        collapseWhitespace: true,
        removeComments: true,
        collapseBooleanAttributes: true,
        minifyCSS: true,
        minifyJS: true,
      });
    }
    return content;
  });

  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("fonts");
  eleventyConfig.addPassthroughCopy("style.css");
  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy("favicon-light.png");
  eleventyConfig.addPassthroughCopy("favicon-dark.png");
  eleventyConfig.addPassthroughCopy("grocery-list.js");
  eleventyConfig.addPassthroughCopy("sprinkles.js");
  eleventyConfig.addPassthroughCopy("app.js");
  eleventyConfig.addPassthroughCopy("kitchen.js");
  eleventyConfig.addPassthroughCopy("search.js");
  eleventyConfig.addPassthroughCopy("manifest.webmanifest");

  // Those two are passthrough copies, so nothing was stripping their comments
  // — and both are commented heavily, sprinkles.js especially. Measured on it:
  // 3.5 KB down to 1.7 KB after the gzip GitHub Pages already applies, on a
  // file every page loads. That's worth a build step in a way minifying
  // style.css wasn't (docs/PERFORMANCE-NOTES.md explains why not), because
  // terser is already in the tree for the HTML minifier above — no new
  // dependency, and the source keeps its comments either way.
  const PASSTHROUGH_SCRIPTS = ["grocery-list.js", "sprinkles.js", "app.js", "kitchen.js", "search.js"];
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const { minify } = require("terser");
    await Promise.all(
      PASSTHROUGH_SCRIPTS.map(async (name) => {
        const file = path.join(dir.output, name);
        if (!fs.existsSync(file)) return;
        const out = await minify(fs.readFileSync(file, "utf8"));
        if (out.code) fs.writeFileSync(file, out.code);
      })
    );
  });

  // The submission form checks a recipe before sending it, and the worker
  // checks it again on arrival. Both read the same file: this inlines
  // submission-worker/validate.js into the page, minus its `export` line
  // (which a plain <script> can't take), so the rules and the wording a
  // visitor sees can't drift apart from the ones actually enforced.
  eleventyConfig.addWatchTarget("submission-worker/validate.js");
  eleventyConfig.addShortcode("submissionValidator", () =>
    fs
      .readFileSync("submission-worker/validate.js", "utf8")
      .replace(/^export\s*\{[^}]*\};?\s*$/m, "")
  );

  eleventyConfig.addFilter("urlencode", (str) => encodeURIComponent(str || ""));

  // JSON for embedding inside <script type="application/ld+json">. Plain
  // JSON.stringify leaves "</script>" and "<!--" intact, so a title or note
  // containing either can close the block early and inject markup. Escaping
  // "<" as \u003c keeps the value inert while parsing back to the exact same
  // string, so the structured data is unchanged.
  eleventyConfig.addFilter("jsonld", (value) =>
    JSON.stringify(value === undefined ? null : value).replace(/</g, "\\u003c")
  );

  // "35" -> "35 min", "65" -> "1 hr 5 min", "180" -> "3 hr"
  eleventyConfig.addFilter("minutesLabel", (minutes) => {
    const n = Number(minutes) || 0;
    if (n < 60) return `${n} min`;
    const m = n % 60;
    return `${Math.floor(n / 60)} hr${m ? ` ${m} min` : ""}`;
  });

  eleventyConfig.addFilter("isoDuration", (minutes) => {
    const n = Number(minutes) || 0;
    return `PT${n}M`;
  });

  // Used for <lastmod> dates in sitemap.xml
  eleventyConfig.addFilter("isoDate", (date) => {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 10);
  });

  eleventyConfig.addFilter("byCategories", (recipes, categories) =>
    (recipes || []).filter((r) => categories.includes(r.data.category))
  );

  // The homepage's course sections: each section that has at least one recipe,
  // with its recipes attached, so empty sections never render.
  eleventyConfig.addFilter("sectionsWithRecipes", (sections, recipes) =>
    sections
      .map((s) => ({ ...s, items: (recipes || []).filter((r) => s.categories.includes(r.data.category)) }))
      .filter((s) => s.items.length)
  );

  // Decap's image widget writes the public_folder-prefixed path
  // (e.g. "/images/x.jpg"); older recipes migrated by hand just store the
  // bare filename (e.g. "x.jpg"). Handle both.
  //
  // A photo that isn't in images/ (deleted in the CMS while a recipe still
  // pointed at it, say) gives "" here, so the recipe shows the plain placeholder
  // instead of the image step throwing and stopping the whole site from building.
  const photoExists = (image) => {
    const file = image.startsWith("/") ? image.slice(1) : path.join("images", image);
    return fs.existsSync(file);
  };

  // Every recipe list: recipes with a photo first, then newest first within each half.
  const hasPhoto = (r) => (r.data.image && photoExists(r.data.image) ? 1 : 0);
  const photoFirst = (a, b) => hasPhoto(b) - hasPhoto(a) || b.date - a.date;

  eleventyConfig.addFilter("imageUrl", (image) => {
    if (!image || !photoExists(image)) return "";
    if (image.startsWith("/")) return site.url + image;
    return `${site.url}/images/${image}`;
  });

  // Root-relative path for in-page <img src> — this is what the image
  // transform plugin above actually optimizes. (imageUrl, above, stays a
  // full URL for contexts read by outside services: og:image, JSON-LD,
  // the Pinterest share link.)
  eleventyConfig.addFilter("imageSrc", (image) => {
    if (!image || !photoExists(image)) return "";
    if (image.startsWith("/")) return image;
    return `/images/${image}`;
  });

  // The recipe page's "More recipes" strip: the most recent recipes other than
  // the one being viewed, so every recipe page links onward instead of dead-ending.
  eleventyConfig.addFilter("relatedRecipes", (recipes, currentUrl, limit = 3) =>
    (recipes || []).filter((r) => r.url !== currentUrl).slice(0, limit)
  );

  // Best-effort "when did this source file last change", for <lastmod> in the
  // sitemap. Prefers the file's last git commit date — that's stable across CI
  // checkouts, where every file's mtime is just the checkout time — and falls
  // back to the file's own mtime when git isn't available.
  eleventyConfig.addFilter("lastUpdated", (file) => {
    if (!file) return "";
    try {
      // execFileSync, not execSync: the path is passed as an argument rather
      // than spliced into a shell string, so a filename can never become a
      // command.
      const { execFileSync } = require("child_process");
      const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
      if (out) return out;
    } catch (e) {
      /* fall through to mtime */
    }
    try {
      return fs.statSync(file).mtime.toISOString().slice(0, 10);
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  });

  // RFC 822 dates for the RSS feed (<pubDate>).
  eleventyConfig.addFilter("rfc822", (date) => new Date(date).toUTCString());

  eleventyConfig.addCollection("recipes", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("_recipes/*.md")
      // A recipe with `draft: true` still builds its own page (so a reviewer
      // can open the link and check it), but is left out of every listing
      // driven by this collection — the homepage sections and sitemap.xml —
      // until the draft flag comes off. This is what keeps a recipe merged
      // from the public-submission PR flow off the live site until it's ready.
      .filter((recipe) => !recipe.data.draft)
      .sort(photoFirst)
  );

  // "Quick picks": two fixed ways to slice the recipes, each with its own page (quick.njk)
  // and a chip on the homepage. Both are worked out from the recipe's own numbers, so there
  // is nothing extra to fill in.
  //   - 15 / 30 minutes or less: prep + cook (chilling, resting and rising aren't counted, which
  //     is how the site shows times everywhere).
  //   - 6 ingredients or fewer: not counting salt, pepper, water and plain oil, anything
  //     marked optional, or "to serve / for frying" extras.
  const FAST_MINUTES = 15;
  const QUICK_MINUTES = 30;
  const SIMPLE_INGREDIENTS = 6;
  const PANTRY = [
    /^(?:kosher |sea |table |flaky )?salt\b/i,
    /^(?:freshly |ground |black |white )*pepper\b/i,
    /^(?:warm |cold |hot |boiling |ice )*water\b/i,
    /^(?:extra[- ]?virgin |extra[- ]?light |light |neutral |vegetable |canola |olive |cooking |peanut |corn )*(?:or )?(?:vegetable |canola |olive )?oil\b/i,
  ];
  // Vegetarian: no meat, poultry, fish or shellfish named anywhere in the ingredient list
  // (optional lines included, so "chicken, shrimp or tofu" doesn't count). Eggs and dairy are fine.
  const MEAT = /\b(chicken|beef|pork|lamb|mutton|goat|veal|turkey|duck|bacon|ham|prosciutto|pancetta|chorizo|sausages?|salami|pepperoni|hot dogs?|steak|ribs?|brisket|mince|ground (?:beef|pork|turkey|lamb|meat)|meatballs?|oxtail|liver|tripe|anchov(?:y|ies)|fish|salmon|tuna|cod|haddock|tilapia|sardines?|mackerel|trout|shrimp|prawns?|crab|lobster|scallops?|clams?|mussels?|oysters?|squid|calamari|octopus|gelatin|lard|suet|bone broth|bouillon|fish sauce|oyster sauce|worcestershire|boerewors|biltong|droewors|gammon|spam|nduja|guanciale|jerky|bacon bits)\b/i;
  const isVegetarian = (r) => {
    const ing = (r.data.recipeContent || {}).ingredients || [];
    return ing.length > 0 && !ing.some((i) => MEAT.test(String(i.item || "")));
  };
  // One pot / one pan: the recipe says so in its title, description or method.
  const ONE_POT = /\b(one[- ](?:pot|pan|skillet|dish|bowl and pan)|sheet[- ]pan|single (?:pot|pan|skillet)|same (?:pot|pan|skillet)|dutch oven)\b/i;
  const isOnePot = (r) => {
    const c = r.data.recipeContent || {};
    return ONE_POT.test([r.data.title, r.data.description, ...(c.steps || [])].join(" \n "));
  };
  const minutesOf = (r) => ((r.data.recipeContent || {}).prepTimeMinutes || 0) + ((r.data.recipeContent || {}).cookTimeMinutes || 0);
  const coreIngredients = (r) =>
    ((r.data.recipeContent || {}).ingredients || []).filter((i) => {
      const item = String(i.item || "").trim();
      const amount = String(i.amount || "").trim();
      if (/\boptional\b/i.test(item)) return false;
      if (/^(to|for) /i.test(amount)) return false;
      return !PANTRY.some((re) => re.test(item));
    }).length;
  eleventyConfig.addCollection("quickPicks", (collectionApi) => {
    const recipes = collectionApi.getFilteredByGlob("_recipes/*.md").filter((r) => !r.data.draft).sort(photoFirst);
    return [
      {
        slug: "quick-15",
        name: `${FAST_MINUTES} minutes or less`,
        title: `Ready in ${FAST_MINUTES} minutes or less`,
        blurb: `Recipes where prep and cooking together take ${FAST_MINUTES} minutes or less. Time spent chilling, resting or rising isn't counted, so check the recipe if it needs any.`,
        items: recipes.filter((r) => minutesOf(r) > 0 && minutesOf(r) <= FAST_MINUTES),
      },
      {
        slug: "quick",
        name: `${QUICK_MINUTES} minutes or less`,
        title: `Ready in ${QUICK_MINUTES} minutes or less`,
        blurb: `Recipes where prep and cooking together take ${QUICK_MINUTES} minutes or less. Time spent chilling, resting or rising isn't counted, so check the recipe if it needs any.`,
        items: recipes.filter((r) => minutesOf(r) > 0 && minutesOf(r) <= QUICK_MINUTES),
      },
      {
        slug: "simple",
        name: `${SIMPLE_INGREDIENTS} ingredients or fewer`,
        title: `${SIMPLE_INGREDIENTS} ingredients or fewer`,
        blurb: `Recipes that need ${SIMPLE_INGREDIENTS} ingredients or fewer, not counting salt, pepper, water, plain cooking oil, optional extras or things to serve alongside.`,
        items: recipes.filter((r) => coreIngredients(r) <= SIMPLE_INGREDIENTS),
      },
      {
        slug: "vegetarian",
        name: "Vegetarian",
        title: "Vegetarian recipes",
        blurb: "Recipes with no meat, poultry, fish or shellfish in the ingredient list. Eggs and dairy are fine. Check the recipe for stock or sauces if you're strict.",
        items: recipes.filter(isVegetarian),
      },
      {
        slug: "one-pot",
        name: "One pot or one pan",
        title: "One pot and one pan recipes",
        blurb: "Recipes made in a single pot, pan, skillet or sheet pan, so there's less washing up.",
        items: recipes.filter(isOnePot),
      },
    ].filter((p) => p.items.length);
  });

  // One entry per cuisine that has at least two (published) recipes, biggest first.
  // Each gets its own page (cuisine.njk) and a chip in the homepage's "By cuisine"
  // strip; a cuisine with a single recipe is just a label on that recipe.
  const cuisineSlug = (name) =>
    String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const CUISINES_FIRST = ["West African", "South African", "French", "Middle Eastern"];
  eleventyConfig.addCollection("cuisines", (collectionApi) => {
    const byCuisine = new Map();
    for (const recipe of collectionApi.getFilteredByGlob("_recipes/*.md").filter((r) => !r.data.draft).sort(photoFirst)) {
      const name = String(recipe.data.cuisine || "").trim();
      if (!name) continue;
      if (!byCuisine.has(name)) byCuisine.set(name, []);
      byCuisine.get(name).push(recipe);
    }
    return [...byCuisine]
      .filter(([, items]) => items.length >= 2)
      .map(([name, items]) => ({ name, slug: cuisineSlug(name), items }))
      .sort((a, b) => {
        // These four lead the strip, in this order; everything else follows, biggest first.
        const rank = (n) => { const i = CUISINES_FIRST.indexOf(n); return i < 0 ? CUISINES_FIRST.length : i; };
        return rank(a.name) - rank(b.name) || b.items.length - a.items.length || a.name.localeCompare(b.name);
      });
  });
  // My Kitchen (kitchen.njk): the ingredient list and swaps for the picker, and
  // each recipe's ingredient lines mapped to those names, worked out here at
  // build time so new recipes need nothing extra. See lib/kitchen.js.
  eleventyConfig.addGlobalData("kitchen", () => kitchen.pageData());
  eleventyConfig.addFilter("kitchenLines", (recipe) =>
    JSON.stringify(kitchen.recipeKitchen((recipe.data.recipeContent || {}).ingredients))
  );

  // The homepage search (search.js) loads this once: one row per recipe,
  // [title, url, "35 min · 4 servings", cuisine, category, ingredient names].
  // Ingredient names come from the My Kitchen matcher, so "chicken" finds
  // every chicken recipe without shipping 3,000 ingredient lines.
  eleventyConfig.addFilter("searchIndex", (recipes) =>
    JSON.stringify(
      (recipes || []).map((r) => {
        const c = r.data.recipeContent || {};
        const total = (c.prepTimeMinutes || 0) + (c.cookTimeMinutes || 0);
        const time = total ? (total < 60 ? `${total} min` : `${Math.floor(total / 60)} hr${total % 60 ? ` ${total % 60} min` : ""}`) : "";
        const serves = c.servingsNumber ? `${c.servingsNumber} ${String(c.servingsUnit || "servings").toLowerCase()}` : "";
        const k = kitchen.recipeKitchen(c.ingredients);
        // salt, pepper, oil and water are in nearly everything, so they'd only add noise
        const ings = [...new Set([...k.n, ...k.o].flat().map((id) => kitchen.INGREDIENTS[id].name))]
          .filter((n) => !kitchen.STAPLES.includes(n))
          .join(", ");
        return [r.data.title, r.url, [time, serves].filter(Boolean).join(" · "), r.data.cuisine || "", r.data.category || "", ings];
      })
    )
  );

  // "/cuisine/thai/" when that cuisine has a page, otherwise "" (so the label stays plain text)
  eleventyConfig.addFilter("cuisinePage", (name, cuisines) => {
    const hit = (cuisines || []).find((c) => c.name === name);
    return hit ? "/cuisine/" + hit.slug + "/" : "";
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
};
