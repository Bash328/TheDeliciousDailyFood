const fs = require("fs");
const path = require("path");
const site = require("./_data/site.js");
const { eleventyImageTransformPlugin } = require("@11ty/eleventy-img");

// The two CMS logins (/admin/ with GitHub, /admin/collaborator/ with an email
// and password) each need their own config.yml, because each names a different
// backend — but they must offer the same fields, or a recipe saved from one
// login loses whatever the other one knows about. Nothing enforces that, so
// this compares the two files' collections blocks and says so at build time if
// they've drifted. A warning only: a mismatch shouldn't stop the site shipping.
function warnIfCmsConfigsDiverge() {
  const collectionsBlock = (file) => {
    const text = fs.readFileSync(file, "utf8");
    const start = text.indexOf("collections:");
    return start === -1 ? null : text.slice(start).trim();
  };
  try {
    const a = collectionsBlock("admin/config.yml");
    const b = collectionsBlock("admin/collaborator/config.yml");
    if (a && b && a !== b) {
      console.warn(
        "[cms] admin/config.yml and admin/collaborator/config.yml define " +
          "different fields. Whichever one you edited, copy the collections " +
          "block into the other so both logins stay in sync."
      );
    }
  } catch (err) {
    console.warn("[cms] couldn't compare the two admin configs: " + err.message);
  }
}

module.exports = function (eleventyConfig) {
  warnIfCmsConfigsDiverge();

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
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy("favicon-light.png");
  eleventyConfig.addPassthroughCopy("favicon-dark.png");
  eleventyConfig.addPassthroughCopy("grocery-list.js");
  eleventyConfig.addPassthroughCopy("sprinkles.js");

  // Those two are passthrough copies, so nothing was stripping their comments
  // — and both are commented heavily, sprinkles.js especially. Measured on it:
  // 3.5 KB down to 1.7 KB after the gzip GitHub Pages already applies, on a
  // file every page loads. That's worth a build step in a way minifying
  // style.css wasn't (docs/PERFORMANCE-NOTES.md explains why not), because
  // terser is already in the tree for the HTML minifier above — no new
  // dependency, and the source keeps its comments either way.
  const PASSTHROUGH_SCRIPTS = ["grocery-list.js", "sprinkles.js"];
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

  // "35" -> "35 min", "185" -> "3 hr" (matches the site's existing hand-written labels)
  eleventyConfig.addFilter("minutesLabel", (minutes) => {
    const n = Number(minutes) || 0;
    if (n < 60) return `${n} min`;
    return `${Math.floor(n / 60)} hr`;
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

  // Decap's image widget writes the full public_folder-prefixed path
  // (e.g. "/TheDeliciousDailyFood/images/x.jpg"); older recipes migrated by
  // hand just store the bare filename (e.g. "x.jpg"). Handle both.
  eleventyConfig.addFilter("imageUrl", (image) => {
    if (!image) return "";
    if (image.startsWith("/")) return site.url + image;
    return `${site.url}${site.baseUrl}/images/${image}`;
  });

  // Root-relative path for in-page <img src> — this is what the image
  // transform plugin above actually optimizes. (imageUrl, above, stays a
  // full URL for contexts read by outside services: og:image, JSON-LD,
  // the Pinterest share link.)
  eleventyConfig.addFilter("imageSrc", (image) => {
    if (!image) return "";
    if (image.startsWith("/")) return image;
    return `/images/${image}`;
  });

  eleventyConfig.addCollection("recipes", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("_recipes/*.md")
      // A recipe with `draft: true` still builds its own page (so a reviewer
      // can open the link and check it), but is left out of every listing
      // driven by this collection — the homepage sections and sitemap.xml —
      // until the draft flag comes off. This is what keeps a recipe merged
      // from the public-submission PR flow off the live site until it's ready.
      .filter((recipe) => !recipe.data.draft)
      .sort((a, b) => b.date - a.date)
  );

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
