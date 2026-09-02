const site = require("./_data/site.js");

module.exports = function (eleventyConfig) {
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
