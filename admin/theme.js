// Light restyle for the Decap CMS admin so it feels like part of the site
// instead of stock CMS chrome. Shared by both /admin/ (GitHub login) and
// /admin/collaborator/ (email login).
//
// Style: "Index Card" — ruled paper background, monospace headers, a card-
// catalog red rule line.
//
// Deliberately modest. The `logo_url` / `site_url` / `display_url` keys in
// each config.yml are Decap's officially supported branding hooks and are
// guaranteed to keep working across upgrades. Everything below — the fonts,
// the colors, the class-name selectors — is a best-effort CSS injection on
// top of Decap's rendered markup, which is NOT a documented, stable API. It
// looks right against the Decap 3.x build in use when this was written; if a
// future Decap upgrade renames its internal classes, some of these rules will
// quietly stop matching (nothing breaks, the admin just looks more stock
// again). If that happens, open the admin in your browser's dev tools,
// inspect the element you want to restyle, and update the selector below.

(function () {
  var INK = "#2a2620";
  var RED = "#a5453a";
  var PAPER = "#f7f4ea";
  var RULE = "#e3dcc6";
  var MONO = "'IBM Plex Mono', ui-monospace, monospace";
  var SANS = "'IBM Plex Sans', system-ui, sans-serif";

  // A <link> rather than an @import inside the injected stylesheet: @import is
  // only honored as the first rule of a sheet, which makes it fragile to edit
  // around later, and it blocks the rest of these rules on the font request.
  var font = document.createElement("link");
  font.rel = "stylesheet";
  font.href =
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500" +
    "&family=IBM+Plex+Sans:wght@400;500&display=swap";
  document.head.appendChild(font);

  var style = document.createElement("style");
  style.textContent = [
    /* Ruled index-card paper, behind everything */
    "html, body, #nc-root {",
    "  background: " + PAPER + ";",
    "  background-image: repeating-linear-gradient(" +
      PAPER + " 0 27px, " + RULE + " 27px 28px);",
    "  font-family: " + SANS + " !important;",
    "}",

    /* Login screen button */
    "[class*='LoginButton'], button[class*='Login'] {",
    "  background: " + INK + " !important;",
    "  color: " + PAPER + " !important;",
    "  border-radius: 1px !important;",
    "  font-family: " + MONO + " !important;",
    "  letter-spacing: 0.02em;",
    "}",

    /* Top app bar */
    "[class*='AppHeader'], [class*='TopBarContainer'] {",
    "  background: " + INK + " !important;",
    "  font-family: " + MONO + " !important;",
    "}",

    /* Primary action buttons (Publish, New Recipe, and friends) */
    "[class*='ToolbarButton'][class*='Primary'], button[class*='WidgetButton'] {",
    "  background: " + RED + " !important;",
    "  border-color: " + RED + " !important;",
    "  border-radius: 1px !important;",
    "}",

    /* Sidebar nav, active entry */
    "[class*='SidebarListItemLink'][aria-current='page'],",
    "a[class*='SidebarNavLink'][class*='Active'] {",
    "  color: " + RED + " !important;",
    "  border-color: " + RED + " !important;",
    "}",

    /* Field labels and collection titles in the monospace voice */
    "[class*='ControlLabel'], [class*='CollectionTop'] h1 {",
    "  font-family: " + MONO + " !important;",
    "}",
  ].join("\n");
  document.head.appendChild(style);

  var favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/png";
  favicon.href = "https://thedeliciousdaily.com/favicon-light.png";
  document.head.appendChild(favicon);
})();
