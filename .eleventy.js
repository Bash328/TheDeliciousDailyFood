const site = require("./_data/site.js");
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
  eleventyConfig.addTransform("htmlmin", async function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html")) {
      const { minify } = await import("html-minifier-terser");
      return minify(content, {
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
  eleventyConfig.addPassthroughCopy("style.css");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy("favicon-light.png");
  eleventyConfig.addPassthroughCopy("favicon-dark.png");
  eleventyConfig.addPassthroughCopy("grocery-list.js");

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
    collectionApi.getFilteredByGlob("_recipes/*.md").sort(
      (a, b) => b.date - a.date
    )
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
