module.exports = {
  title: "The Delicious Daily",
  url: "https://thedeliciousdaily.com",

  // Bumped whenever style.css changes, so returning visitors get the new
  // stylesheet instead of a cached one. Used as style.css?v={{ site.assetVersion }}.
  assetVersion: 8,

  tagline: "A daily dose of deliciousness, upgrade your everyday.",

  // Fallback social/OG image for pages that have no photo of their own
  // (homepage, About, Contact, the grocery tool, Submit a Recipe). Generated
  // by tools/make-og-default.js — 1200x630, matching the site palette.
  defaultOgImage: "/images/og-default.png",

  // Public recipe submissions — see docs/SUBMISSION-FORM-SETUP.md.
  // Until submitEndpoint is filled in with the deployed submission worker's
  // URL, /submit-recipe/ builds as a short "not open for submissions" note
  // instead of a form that can't send anywhere, and nothing links to it.
  submitEndpoint:
    "https://delicious-daily-submissions.cwakiku.workers.dev/submit",
  // Optional Cloudflare Turnstile site key for spam filtering on that form.
  // Leave empty to skip it — the widget isn't loaded at all when it's blank,
  // rather than rendering an error box with a placeholder key.
  turnstileSiteKey: "",
};
