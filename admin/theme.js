// Restyle for the Decap CMS admin so it feels like part of the site instead of
// stock CMS chrome.
//
// Style: "Recipe notebook" — warm paper with pale-blue ruled lines and a
// terracotta margin line, a dark stitched-leather top bar, white "sheets" for
// the cards and the form, fields that read like lines written on a page, and a
// yellow highlighter pen for what's selected. Type is IBM Plex: Mono for titles
// and labels, Sans for everything you read and type. Labels and hints are plain
// sentence case at a readable size, so every word is visible without wrapping
// into spaced-out capitals.
//
// Deliberately a CSS-only layer. The `logo_url` / `site_url` / `display_url`
// keys in config.yml are Decap's officially supported branding hooks and keep
// working across upgrades. Everything below — the colours, the class-name
// selectors — is a best-effort injection on top of Decap's rendered markup,
// which is NOT a documented, stable API. It looks right against the Decap 3.x
// build in use when this was written; if a future Decap upgrade renames its
// internal classes, some rules will quietly stop matching (nothing breaks, the
// admin just looks more stock again). If that happens, open the admin in your
// browser's dev tools, inspect the element you want to restyle, and update the
// selector here.
//
// Fonts are self-hosted in ./fonts (no request to Google).

(function () {
  var INK = "#2a2620";
  var INK_SOFT = "#6b6358";
  var PAPER = "#f7f1e3";
  var SHEET = "#fffdf6";
  var EDGE = "#ddd3ba";        // sheet and field outlines
  var UNDERLINE = "#b8aa88";   // the heavier line under a field
  var RULED = "rgba(110, 150, 190, 0.30)";   // notebook blue
  var MARGIN = "rgba(217, 120, 92, 0.60)";   // the red margin line, in brand terracotta
  var ACCENT = "#a8553a";
  var ACCENT_DARK = "#8a3f27";
  var HIGHLIGHT = "rgba(246, 226, 122, 0.80)";
  var MONO = "'IBM Plex Mono', ui-monospace, monospace";
  var SANS = "'IBM Plex Sans', system-ui, sans-serif";

  function face(family, style, weight, file) {
    return (
      "@font-face { font-family: '" + family + "'; font-style: " + style +
      "; font-weight: " + weight + "; font-display: swap; src: url('/fonts/" + file +
      "') format('woff2'); }"
    );
  }

  // The ruled lines every 32px, plus the margin line at x. `x` is any CSS length.
  function paper(x) {
    return (
      "linear-gradient(90deg, transparent calc(" + x + " - 1px), " + MARGIN +
      " calc(" + x + " - 1px) calc(" + x + " + 1px), transparent calc(" + x + " + 1px)), " +
      "repeating-linear-gradient(to bottom, transparent 0 31px, " + RULED + " 31px 32px)"
    );
  }

  var style = document.createElement("style");
  style.textContent = [
    face("IBM Plex Mono", "normal", "400", "ibm-plex-mono-400.woff2"),
    face("IBM Plex Mono", "normal", "500", "ibm-plex-mono-500.woff2"),
    face("IBM Plex Mono", "normal", "600", "ibm-plex-mono-600.woff2"),
    /* one variable file covers every weight of the Sans */
    face("IBM Plex Sans", "normal", "400 700", "ibm-plex-sans-400.woff2"),

    /* ---- The page: ruled paper with a margin line ---- */
    "html, body, #nc-root {",
    "  background-color: " + PAPER + ";",
    "  background-image: " + paper("282px") + ";",
    "  font-family: " + SANS + " !important;",
    "  color: " + INK + ";",
    "}",
    /* In the editor there's no sidebar, so the margin runs just left of the page. */
    "html:has([class*='EditorContainer']), html:has([class*='EditorContainer']) body,",
    "html:has([class*='EditorContainer']) #nc-root {",
    "  background-image: " + paper("calc(50% - 424px)") + ";",
    "}",
    "::selection { background: " + HIGHLIGHT + "; color: " + INK + "; }",
    "* { scrollbar-color: #c9bd9f transparent; scrollbar-width: thin; }",

    /* ---- Top bar: dark leather with a stitched edge ---- */
    "header[class*='AppHeader'] {",
    "  position: relative;",
    "  background: " + INK + " !important;",
    "  font-family: " + SANS + " !important;",
    "}",
    "header[class*='AppHeader']::after {",
    "  content: ''; position: absolute; left: 10px; right: 10px; bottom: 5px;",
    "  border-bottom: 2px dashed rgba(224, 190, 120, 0.55); pointer-events: none;",
    "}",
    "[class*='AppHeaderButton'], [class*='AppHeaderQuickNewButton'], [class*='AppHeaderSiteLink'] {",
    "  font-family: " + MONO + " !important; font-weight: 500 !important;",
    "  font-size: 14px !important; letter-spacing: 0.01em;",
    "  background-color: transparent !important; color: rgba(247, 241, 227, 0.72) !important;",
    "}",
    "[class*='AppHeaderButton']:hover, [class*='AppHeaderSiteLink']:hover { color: #fff !important; }",
    "[class*='AppHeaderNavLink'][aria-current='page'] {",
    "  color: #fff !important; background-color: transparent !important;",
    "  box-shadow: inset 0 -4px 0 " + HIGHLIGHT + ";",
    "}",

    /* ---- Sidebar: the index tab down the left ---- */
    "[class*='SidebarContainer'] {",
    "  background: " + SHEET + "; border: 1px solid " + EDGE + "; border-radius: 3px;",
    "  box-shadow: 0 1px 0 rgba(42, 38, 32, 0.06), 0 10px 22px -14px rgba(42, 38, 32, 0.35);",
    "}",
    "[class*='SidebarHeading'] { font-family: " + MONO + " !important; font-weight: 600 !important; font-size: 20px !important; color: " + INK + "; }",
    "[class*='SidebarNavLink'] { font-family: " + SANS + " !important; font-weight: 500; font-size: 15px; color: " + INK + " !important; border-left-color: transparent !important; }",
    "[class*='SidebarNavLink'] svg, [class*='SidebarNavLink'] [class*='Icon'] { color: " + ACCENT + "; }",
    "[class*='SidebarNavLink'][aria-current='page'] { background: " + HIGHLIGHT + " !important; border-left: 3px solid " + ACCENT + " !important; }",
    "[class*='SidebarContainer'] input { background: " + PAPER + " !important; border: 1.5px solid " + EDGE + " !important; border-bottom: 2px solid " + UNDERLINE + " !important; border-radius: 2px !important; font-family: " + SANS + " !important; color: " + INK + " !important; }",

    /* ---- The list: each recipe is a line on a sheet ---- */
    "[class*='CollectionTopContainer'] {",
    "  background: " + SHEET + "; border: 1px solid " + EDGE + "; border-radius: 3px;",
    "  box-shadow: 0 1px 0 rgba(42, 38, 32, 0.06), 0 10px 22px -14px rgba(42, 38, 32, 0.35);",
    "}",
    "[class*='CollectionTopHeading'] { font-family: " + MONO + " !important; font-weight: 600 !important; font-size: 28px !important; color: " + INK + " !important; }",
    "[class*='CollectionTopNewButton'] {",
    "  background: " + INK + " !important; color: " + PAPER + " !important; border-radius: 2px !important;",
    "  font-family: " + MONO + " !important; font-weight: 500; letter-spacing: 0.01em; font-size: 14px !important;",
    "  box-shadow: 2px 2px 0 " + ACCENT + " !important; transition: transform 0.12s ease, box-shadow 0.12s ease;",
    "}",
    "[class*='CollectionTopNewButton']:hover { transform: translate(1px, 1px); box-shadow: 1px 1px 0 " + ACCENT + " !important; }",
    "[class*='ViewControlsButton'], [class*='ControlButton'] { font-family: " + SANS + " !important; font-weight: 500 !important; font-size: 14px !important; color: " + INK_SOFT + " !important; }",
    "[class*='ViewControlsSection'] svg, [class*='ViewControlsButton'] svg { color: " + ACCENT + "; }",
    "[class*='ListCard-'] {",
    "  background: " + SHEET + " !important; border: 1px solid " + EDGE + " !important; border-radius: 3px !important;",
    "  box-shadow: 0 1px 0 rgba(42, 38, 32, 0.05) !important; transition: transform 0.12s ease, box-shadow 0.12s ease;",
    "}",
    "[class*='ListCard-']:hover { transform: translateY(-1px); box-shadow: 0 8px 18px -12px rgba(42, 38, 32, 0.45) !important; }",
    "[class*='ListCardTitle'] { font-family: " + SANS + " !important; font-weight: 500 !important; font-size: 17px !important; line-height: 1.3; color: " + INK + " !important; }",
    "[class*='AppHeaderNavLink'] [class*='IconWrapper'], [class*='AppHeaderButton'] [class*='IconWrapper'] { color: inherit !important; }",
    "[class*='ListCardLink'] { border: 0 !important; box-shadow: none !important; background: transparent !important; }",

    /* ---- Editor top bar: a white strip with a tear-off line ---- */
    "[class*='ToolbarContainer'] {",
    "  background: " + SHEET + " !important; box-shadow: none !important;",
    "  border-bottom: 2px dashed rgba(168, 85, 58, 0.45);",
    "  font-family: " + SANS + " !important;",
    "}",
    "[class*='BackArrow'], [class*='BackCollection'] { color: " + INK + "; }",
    "[class*='BackCollection'] { font-family: " + SANS + " !important; font-size: 14px; }",
    "[class*='PublishedToolbarButton'], [class*='ToolbarDropdown'] [class*='DropdownButton'] {",
    "  background: rgba(63, 122, 91, 0.12) !important; color: #2f6a4a !important; border-radius: 2px !important;",
    "  font-weight: 500; letter-spacing: 0.04em;",
    "}",
    "[class*='DeleteButton'] { border-radius: 2px !important; font-weight: 500; letter-spacing: 0.04em; }",
    "[class*='AppHeaderSiteLink'][class*='Toolbar'], [class*='ToolbarSectionMeta'] a { color: " + ACCENT + " !important; }",

    /* ---- The form: labels in pencil, fields as ruled lines ---- */
    "[class*='ControlContainer'] { font-family: " + SANS + "; }",
    "[class*='FieldLabel'] {",
    "  background: transparent !important; color: " + ACCENT + " !important; border-radius: 0 !important;",
    "  padding: 0 0 6px !important; font-family: " + MONO + " !important; font-weight: 500 !important;",
    "  font-size: 14px !important; letter-spacing: 0.01em; text-transform: none !important;",
    "  white-space: normal !important; overflow: visible !important; text-overflow: clip !important; max-width: 100% !important; line-height: 1.35;",
    "}",
    /* Decap draws the old grey tab's slanted end with a pseudo-element; it was
       left behind as a white notch after every label. */
    "[class*='FieldLabel']::before, [class*='FieldLabel']::after { display: none !important; content: none !important; }",
    "[class*='ControlHint'] { font-family: " + SANS + " !important; font-size: 14.5px !important; color: #5f564a !important; line-height: 1.5; }",
    "[class*='EditorContainer'] input:not([type='checkbox']):not([type='radio']):not([type='file']),",
    "[class*='EditorContainer'] textarea, [class*='EditorContainer'] select {",
    "  background: " + SHEET + " !important; color: " + INK + " !important;",
    "  border: 1.5px solid " + EDGE + " !important; border-bottom: 2px solid " + UNDERLINE + " !important;",
    "  border-radius: 2px !important; font-family: " + SANS + " !important;",
    "}",
    "[class*='EditorContainer'] input:focus, [class*='EditorContainer'] textarea:focus, [class*='EditorContainer'] select:focus {",
    "  border-color: " + ACCENT + " !important; box-shadow: 0 0 0 3px rgba(168, 85, 58, 0.16) !important; outline: none;",
    "}",
    "[class*='ControlContainer']:focus-within [class*='FieldLabel'] { color: " + ACCENT_DARK + " !important; }",
    "[class*='ControlContainer'] a { color: " + ACCENT + "; }",
    /* Let the ruled paper show through behind the form (Decap paints it grey-blue) */
    "[class*='EditorContainer'], [class*='ControlPaneContainer'], [class*='NoPreviewContainer'], [class*='Editor'] [class*='splitPane'] {",
    "  background: transparent !important; box-shadow: none !important; border: 0 !important;",
    "}",
    /* The boxes around the photo, the Category menu and the Recipe widget */
    "[class*='ControlContainer'] > div:not([class*='ControlHint']):not([class*='FieldLabel']) {",
    "  background: " + SHEET + " !important; border: 1.5px solid " + EDGE + " !important;",
    "  border-bottom: 2px solid " + UNDERLINE + " !important; border-radius: 2px !important;",
    "}",
    "[class*='ControlContainer'] .control, [class*='ControlContainer'] .container .control { background: transparent !important; border: 0 !important; box-shadow: none !important; }",
    "[class*='PreviewLink'], [class*='ToolbarSectionMain'] a { color: " + ACCENT + " !important; }",
    /* The Now / Choose image / Replace with URL / Remove chips */
    "[class*='NowButton'], [class*='FileWidgetButton'] {",
    "  background: rgba(168, 85, 58, 0.09) !important; color: " + ACCENT_DARK + " !important;",
    "  border: 1px solid rgba(168, 85, 58, 0.28) !important; border-radius: 2px !important;",
    "  font-family: " + SANS + " !important; font-weight: 500;",
    "}",
    "[class*='FileWidgetButtonRemove'] { background: rgba(170, 45, 45, 0.07) !important; color: #a32d2d !important; border-color: rgba(170, 45, 45, 0.28) !important; }",
    /* The Quick Paste widget's own buttons (they carry no class) */
    "[class*='ControlContainer'] button:not([class]) {",
    "  background: transparent !important; color: " + ACCENT + " !important;",
    "  border: 1.5px solid " + ACCENT + " !important; border-radius: 2px !important;",
    "  font-family: " + SANS + " !important; font-weight: 500; letter-spacing: 0.04em;",
    "}",
    "[class*='ControlContainer'] button:not([class]):hover { background: " + ACCENT + " !important; color: #fff !important; }",

    /* ---- Pop-ups (the media library) ---- */
    "[class*='StyledModal'] { background: " + SHEET + " !important; border-radius: 3px !important; box-shadow: 0 24px 60px -20px rgba(42, 38, 32, 0.55) !important; }",
    "[class*='LibraryTitle'] { font-family: " + MONO + " !important; font-weight: 600 !important; font-size: 22px !important; color: " + INK + "; }",

    /* ---- Login ---- */
    "[class*='LoginButton'], button[class*='Login'] {",
    "  background: " + INK + " !important; color: " + PAPER + " !important; border-radius: 2px !important;",
    "  font-family: " + MONO + " !important; font-weight: 500; letter-spacing: 0.01em;",
    "  box-shadow: 3px 3px 0 " + ACCENT + " !important;",
    "}",

    /* Primary action buttons (Publish, New Recipe, and friends) */
    "[class*='ToolbarButton'][class*='Primary'] { background: " + ACCENT + " !important; border-color: " + ACCENT + " !important; border-radius: 2px !important; }",

    /* ---- Phones and small tablets ----
       Decap hard-codes an 800px minimum width on the page, header, toolbar and
       editor, and pins a 250px sidebar beside the list. On a phone that is what
       made everything scroll sideways and hid half of every recipe name. */
    "@media (max-width: 800px) {",
    /* the margin line hugs the left edge, as on a real pad */
    "  html, html body, html #nc-root, html:has([class*='EditorContainer']), html:has([class*='EditorContainer']) body, html:has([class*='EditorContainer']) #nc-root {",
    "    background-image: " + paper("12px") + ";",
    "  }",
    "  [class*='AppMainContainer'], [class*='AppHeaderContent'],",
    "  [class*='EditorContainer'], [class*='ToolbarContainer'] {",
    "    min-width: 0 !important; width: 100% !important; margin-right: 0 !important;",
    "  }",
    "  [class*='AppHeaderContent'] { padding: 0 8px; }",
    "  [class*='AppHeaderActions'] { white-space: nowrap; }",
    /* Tighter top nav so Contents / Media / Quick add / avatar fit in 390px. */
    "  [class*='AppHeaderButton'] svg, [class*='AppHeaderButton'] [class*='Icon'] { display: none !important; }",
    "  [class*='AppHeaderButton'] { padding-left: 10px !important; padding-right: 10px !important; letter-spacing: 0.1em !important; }",
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
    "  [class*='CollectionTopHeading'] { font-size: 34px !important; }",
    "  [class*='CardsGrid'] { width: auto !important; margin-left: 0 !important; }",
    "  [class*='ListCard-'] { width: 100% !important; margin-left: 0 !important; }",

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
