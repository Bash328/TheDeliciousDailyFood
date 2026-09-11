module.exports = {
  title: "The Delicious Daily",
  url: "https://thedeliciousdaily.com",
  baseUrl: "",

  // Bumped whenever style.css changes, so returning visitors get the new
  // stylesheet instead of a cached one. Used as style.css?v={{ site.assetVersion }}.
  assetVersion: 3,

  tagline: "A daily dose of deliciousness, upgrade your everyday.",

  // Public recipe submissions — see docs/COLLABORATOR-AND-SUBMISSIONS-SETUP.md.
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
