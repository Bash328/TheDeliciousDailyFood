// One shared file for every tracking/verification code the site uses.
// Paste values in as you get them — each one is optional and simply
// switches on the matching tag site-wide (in partials/tracking.njk) the
// moment it's filled in. Leave a field blank to keep that integration off.
module.exports = {
  // Google Analytics 4 measurement ID, e.g. "G-XXXXXXXXXX"
  googleAnalyticsId: "G-87F9T22WSH",

  // Google AdSense publisher/client ID, e.g. "ca-pub-XXXXXXXXXXXXXXXX"
  googleAdsenseClientId: "",

  // Google Search Console "HTML tag" verification — just the content value,
  // e.g. from <meta name="google-site-verification" content="THIS_PART">
  googleSiteVerification: "",

  // Pinterest domain verification — just the content value, e.g. from
  // <meta name="p:domain_verify" content="THIS_PART">
  pinterestVerification: "",

  // Amazon Associates tracking ID, e.g. "thedeliciousd-20"
  // Filling this in turns on the "Shop this recipe" box on every recipe page.
  amazonAssociateTag: "",
};
