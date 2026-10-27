// Directory data for everything in _recipes/. This replaces the old
// _recipes.json so we can derive per-recipe values in code — a plain JSON file
// can't hold the async function below.
const fs = require("fs");
const path = require("path");
// In eleventy-img v7 the callable wrapper is the default export; the named
// `Image` export is the underlying class.
const eleventyImage = require("@11ty/eleventy-img").default;
const site = require("../_data/site.js");

module.exports = {
  layout: "layouts/recipe.njk",
  permalink: "recipes/{{ slug }}/",

  eleventyComputed: {
    // A single ~1200px-wide JPEG per photo, written to a stable slug-based
    // path (img/og/<slug>-1200.jpeg). This is what og:image and the Recipe
    // JSON-LD's `image` point at — several of the source uploads are
    // multi-megabyte originals, and those are what social crawlers and
    // rich-result parsers would otherwise fetch.
    ogImage: async (data) => {
      const image = data.image;
      const slug = data.slug || (data.page && data.page.fileSlug);
      if (!image || !slug) return null;
      const src = image.startsWith("/")
        ? image.replace(/^\//, "")
        : path.join("images", image);
      if (!fs.existsSync(src)) return null;
      try {
        const metadata = await eleventyImage(src, {
          widths: [1200],
          formats: ["jpeg"],
          outputDir: "./_site/img/og/",
          urlPath: "/img/og/",
          filenameFormat: (id, srcPath, width, format) => `${slug}-${width}.${format}`,
          sharpJpegOptions: { quality: 78, progressive: true },
        });
        const jpeg = metadata.jpeg && metadata.jpeg[0];
        if (!jpeg) return null;
        return { url: site.url + jpeg.url, width: jpeg.width, height: jpeg.height };
      } catch (e) {
        return null;
      }
    },
  },
};
