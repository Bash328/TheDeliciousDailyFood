// Light restyle for the Decap CMS admin at /admin/ so it feels like part of
// the site instead of stock CMS chrome.
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
    "[class*='ToolbarButton'][class*='Primary'] {",
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

    /* ---- Phones and small tablets ----
       Decap hard-codes an 800px minimum width on the page, header, toolbar and
       editor, and pins a 250px sidebar beside the list. On a phone that is what
       made everything scroll sideways and hid half of every recipe name. */
    "@media (max-width: 800px) {",
    "  [class*='AppMainContainer'], [class*='AppHeaderContent'],",
    "  [class*='EditorContainer'], [class*='ToolbarContainer'] {",
    "    min-width: 0 !important; width: 100% !important; margin-right: 0 !important;",
    "  }",
    "  [class*='AppHeaderContent'] { padding: 0 8px; }",
    "  [class*='AppHeaderActions'] { white-space: nowrap; }",
    /* Tighter top nav so Contents / Media / Quick add / avatar fit in 390px. */
    "  [class*='AppHeaderButton'] svg, [class*='AppHeaderButton'] [class*='Icon'] { display: none !important; }",
    "  [class*='AppHeaderButton'] { padding-left: 10px !important; padding-right: 10px !important; }",
    "  [class*='AppHeaderQuickNewButton'] { padding-left: 10px !important; margin-right: 0 !important; }",
    "  [class*='AppHeaderSiteLink'] { display: none !important; }",

    /* The collections sidebar becomes a strip above the list. */
    "  [class*='SidebarContainer'] {",
    "    position: static !important; width: auto !important; margin: 0 0 14px !important;",
    "    padding: 8px 0 !important;",
    "  }",
    "  [class*='SidebarHeading'] { display: none; }",
    "  [class*='CollectionContainer'] { width: auto !important; margin: 14px 12px !important; }",
    "  [class*='CollectionMain'] { padding-left: 0 !important; width: auto !important; }",
    "  [class*='CollectionTopContainer'], [class*='CollectionControlsContainer'] { width: auto !important; }",
    "  [class*='CardsGrid'] { width: auto !important; margin-left: 0 !important; }",
    "  [class*='ListCard'] { width: 100% !important; margin-left: 0 !important; }",

    /* The editor's top bar: keep the arrow, the save status, the Published menu
       and Delete; drop the long "Writing in Recipes collection" text, the
       (unused) preview button and the avatar, which is what pushed it off-screen. */
    "  [class*='BackCollection'], [class*='PreviewButtonContainer'], [class*='ToolbarSectionMeta'] { display: none !important; }",
    "  [class*='ToolbarSectionBackLink'] { min-width: 0 !important; padding-right: 8px !important; }",
    "  [class*='ToolbarSectionMain'] { min-width: 0 !important; flex: 1 1 auto !important; padding: 0 8px !important; justify-content: flex-end; }",

    /* The media library (Media tab, and the photo picker in a recipe): a pop-up
       whose title row held the title and four buttons side by side, wider than
       the phone, so Copy / Delete and the search box ran off the right edge. */
    "  [class*='StyledModal'] { width: 94vw !important; max-width: 94vw !important; padding: 14px !important; }",
    "  [class*='LibraryTop'] { width: auto !important; max-width: 100% !important; }",
    "  [class*='RowContainer'] { flex-wrap: wrap !important; gap: 10px; width: auto !important; max-width: 100% !important; }",
    "  [class*='ButtonsContainer'] { flex-wrap: wrap !important; gap: 8px; margin-left: 0 !important; width: auto !important; max-width: 100% !important; }",
    "  [class*='ButtonsContainer'] { margin-bottom: 10px !important; }",
    "  [class*='ButtonsContainer'] > *, [class*='ActionButton'], [class*='DeleteButton'], [class*='UploadButton'] { margin-left: 0 !important; margin-right: 8px !important; }",
    "  [class*='SearchContainer'], [class*='SearchInput'] { width: 100% !important; max-width: 100% !important; }",

    /* Bigger touch targets, and 16px text so iOS doesn't zoom in on tap. */
    "  input, textarea, select { font-size: 16px !important; }",
    "  button, [class*='SidebarNavLink'], [class*='ListCardLink'] { min-height: 44px; }",
    "}",
  ].join("\n");
  document.head.appendChild(style);

  var favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/png";
  favicon.href = "https://thedeliciousdaily.com/favicon-light.png";
  document.head.appendChild(favicon);
})();
