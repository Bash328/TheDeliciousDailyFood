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
    /* Decap's "Quick add" menu only ever listed "Recipes" (the one collection you
       can create in), which the "New Recipes" button and "+ Quick post" already
       do; opening it also pushed the page wider than a phone. Removed. */
    "[class*='AppHeaderActions'] > div:has(> [class*='AppHeaderQuickNewButton']) { display: none !important; }",
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
    "button[class*='NowButton'], [class*='FileWidgetButton'] {",
    "  background: rgba(168, 85, 58, 0.09) !important; color: " + ACCENT_DARK + " !important;",
    "  border: 1px solid rgba(168, 85, 58, 0.28) !important; border-radius: 2px !important;",
    "  font-family: " + SANS + " !important; font-weight: 500;",
    "}",
    "[class*='FileWidgetButtonRemove'] { background: rgba(170, 45, 45, 0.07) !important; color: #a32d2d !important; border-color: rgba(170, 45, 45, 0.28) !important; }",
    /* "Now" sits inside the date box, vertically centred, instead of hanging off its bottom edge */
    "[class*='DateTimeControl'] { position: relative; }",
    "[class*='DateTimeControl'] input { padding-right: 84px !important; }",
    "div[class*='NowButton'] {",
    "  position: absolute !important; right: 8px !important; top: 50% !important; bottom: auto !important; left: auto !important;",
    "  transform: translateY(-50%); background: transparent !important; border: 0 !important; padding: 0 !important; margin: 0 !important;",
    "}",
    "div[class*='NowButton'] button { min-height: 38px; padding: 0 14px !important; }",

    /* On/off switches (Draft, Came in through the submission form): a clear
       labelled pill instead of Decap's tiny grey track inside a big empty box. */
    "[class*='ControlContainer'][class*='ControlContainer'] > div:has(> [role='switch'][class]) {",
    "  background: transparent !important; border: 0 !important; box-shadow: none !important; padding: 2px 0 6px !important; min-height: 0 !important;",
    "}",
    "[role='switch'][class*='Toggle'] {",
    "  position: relative; width: 96px !important; height: 42px !important; padding: 0 !important; margin: 0 !important;",
    "  border-radius: 999px !important; background: #ddd3ba !important; border: 1.5px solid #c4b894 !important;",
    "  cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease; box-shadow: none !important;",
    "}",
    "[role='switch'][class*='Toggle'] > span { display: none !important; }",
    "[role='switch'][class*='Toggle']::before {",
    "  content: 'Off'; position: absolute; right: 16px; top: 50%; transform: translateY(-50%);",
    "  font: 600 14px " + MONO + "; color: " + INK_SOFT + ";",
    "}",
    "[role='switch'][class*='Toggle']::after {",
    "  content: ''; position: absolute; top: 3px; left: 3px; width: 33px; height: 33px; border-radius: 50%;",
    "  background: #fff; box-shadow: 0 1px 3px rgba(42, 38, 32, 0.4); transition: transform 0.15s ease;",
    "}",
    "[role='switch'][class*='Toggle'][aria-checked='true'] { background: " + ACCENT + " !important; border-color: " + ACCENT_DARK + " !important; }",
    "[role='switch'][class*='Toggle'][aria-checked='true']::before { content: 'On'; left: 18px; right: auto; color: #fff; }",
    "[role='switch'][class*='Toggle'][aria-checked='true']::after { transform: translateX(54px); }",
    "[role='switch'][class*='Toggle']:focus-visible { outline: 2px solid " + ACCENT + " !important; outline-offset: 3px; }",

    /* The Quick Paste widget's own buttons (they carry no class) */
    "[class*='ControlContainer'] button:not([class]) {",
    "  background: transparent !important; color: " + ACCENT + " !important;",
    "  border: 1.5px solid " + ACCENT + " !important; border-radius: 2px !important;",
    "  font-family: " + SANS + " !important; font-weight: 500; letter-spacing: 0.04em;",
    "}",
    "[class*='ControlContainer'] button:not([class]):hover { background: " + ACCENT + " !important; color: #fff !important; }",

    /* ---- Dropdown menus: Sort / Filter / Group, Quick add, Published, the avatar ---- */
    "[class*='DropdownList'] {",
    "  background: " + SHEET + " !important; border: 1px solid " + EDGE + " !important; border-radius: 3px !important;",
    "  box-shadow: 0 16px 32px -14px rgba(42, 38, 32, 0.55) !important; padding: 4px 0 !important; min-width: 190px; overflow: hidden;",
    "}",
    "[class*='dropdownItem'] {",
    "  font-family: " + SANS + " !important; font-size: 15px !important; color: " + INK + " !important;",
    "  padding: 12px 16px !important; min-height: 44px; border-radius: 0 !important; background: transparent;",
    "}",
    "[class*='dropdownItem']:hover, [class*='dropdownItem']:focus, [class*='dropdownItem'][aria-selected='true'] {",
    "  background: " + HIGHLIGHT + " !important; color: " + INK + " !important; outline: none;",
    "}",
    /* The editor toolbar's Publish menu opened flush with the LEFT edge of its
       button, so on a phone (the button is at the right) it ran off the screen
       and "Publish and create new" was cut off. Open it leftward instead. */
    "[class*='ToolbarContainer'] [class*='DropdownList'] { left: auto !important; right: 0 !important; }",
    "[class*='DropdownList'] { max-width: calc(100vw - 16px); }",
    /* the blue focus box Decap draws around an open menu's button */
    "[class*='ViewControlsButton']:focus, [class*='ControlButton']:focus, [class*='StyledDropdownButton']:focus {",
    "  outline: none !important; box-shadow: none !important;",
    "}",
    "[class*='ViewControlsButton']:focus-visible, [class*='ControlButton']:focus-visible, [class*='StyledDropdownButton']:focus-visible {",
    "  outline: 2px solid " + ACCENT + " !important; outline-offset: 2px;",
    "}",
    "[class*='ViewControlsButton'][aria-expanded='true'], [class*='ControlButton'][aria-expanded='true'] {",
    "  box-shadow: inset 0 -3px 0 " + HIGHLIGHT + " !important;",
    "}",

    /* ---- The Category picker's list ---- */
    "[class*='ControlContainer'] [class$='-menu'], [class*='ControlContainer'] [class*='-menu ']  {",
    "  background: " + SHEET + " !important; border: 1px solid " + EDGE + " !important; border-radius: 3px !important;",
    "  box-shadow: 0 16px 32px -14px rgba(42, 38, 32, 0.55) !important; overflow: hidden; margin-top: 4px;",
    "}",
    "[class*='ControlContainer'] [class*='-option'] {",
    "  font-family: " + SANS + " !important; font-size: 16px !important; color: " + INK + " !important;",
    "  padding: 14px 16px !important; background: transparent !important; cursor: pointer;",
    "}",
    "[class*='ControlContainer'] [class*='-option']:hover, [class*='ControlContainer'] [class*='-option']:active { background: " + HIGHLIGHT + " !important; }",
    "[class*='ControlContainer'] [class*='-option'][aria-selected='true'] { background: " + HIGHLIGHT + " !important; font-weight: 600; }",
    "[class*='ControlContainer'] input[aria-autocomplete='list'] { caret-color: transparent; cursor: pointer; opacity: 0 !important; }",

    /* ---- Floating "Quick post" button on the list screens ---- */
    "a.dd-fab {",
    "  position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 50;",
    "  display: inline-flex; align-items: center; min-height: 54px; padding: 0 22px;",
    "  background: " + ACCENT + "; color: #fff !important; border: 1.5px solid " + ACCENT_DARK + "; border-radius: 2px;",
    "  box-shadow: 3px 3px 0 " + INK + "; font: 500 15px " + MONO + "; text-decoration: none;",
    "}",
    "a.dd-fab:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0 " + INK + "; }",
    "a.dd-fab[hidden] { display: none !important; }",

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
    /* One link per category now (Dinner, Lunch, Dessert, Breakfast, Soup, Submitted):
       lay them out as pills that wrap onto a second line, so every list is visible
       without swiping, and keep a gap under the search box above them. */
    "  [class*='SidebarNavList'] { display: flex !important; flex-wrap: wrap; gap: 8px; padding: 0 12px 4px !important; margin: 14px 0 0 !important; }",
    "  [class*='SidebarNavList'] li { flex: 0 0 auto; }",
    "  [class*='SidebarNavLink'] { white-space: nowrap; border: 1.5px solid " + EDGE + " !important; border-radius: 999px !important; padding: 0 16px !important; }",
    "  [class*='SidebarNavLink'] svg, [class*='SidebarNavLink'] [class*='Icon'] { display: none !important; }",
    "  [class*='SidebarNavLink'][aria-current='page'] { border-color: " + ACCENT + " !important; }",
    "  [class*='CollectionContainer'] { width: auto !important; margin: 14px 12px !important; }",
    "  [class*='CollectionMain'] { padding-left: 0 !important; width: auto !important; }",
    "  [class*='CollectionTopContainer'], [class*='CollectionControlsContainer'] { width: auto !important; }",
    "  [class*='CollectionTopHeading'] { font-size: 24px !important; }",
    "  [class*='CardsGrid'] { width: auto !important; margin-left: 0 !important; }",
    /* "No Entries" / loading / end-of-list messages carry a fixed 682px width. An
       empty list (the Submitted page, when nothing has been sent in) was wider
       than the phone and made the whole page scroll sideways. */
    "  [class*='PaginationMessage'], [class*='NoEntriesMessage'] { width: auto !important; max-width: 100% !important; box-sizing: border-box; text-align: center; padding: 24px 16px !important; }",
    "  [class*='CollectionTopHeading'] { overflow-wrap: anywhere; line-height: 1.2; }",
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
    "  [class*='StyledModal'] [class*='SearchContainer'], [class*='StyledModal'] [class*='SearchInput'] { width: 100% !important; max-width: 100% !important; }",
    /* The list's "Search all" box: Decap gives its container 12px side margins, so at
       full width it ran 12px past the card on the right and sat off-centre. */
    "  [class*='SidebarContainer'] [class*='SearchContainer'] { width: auto !important; box-sizing: border-box; margin: 0 12px !important; }",
    "  [class*='SidebarContainer'] [class*='SearchInput'] { width: 100% !important; box-sizing: border-box; }",

    /* Bigger touch targets, and 16px text so iOS doesn't zoom in on tap. */
    "  input, textarea, select { font-size: 16px !important; }",
    "  button, [class*='SidebarNavLink'], [class*='ListCardLink'] { min-height: 44px; }",
    "  [class*='dropdownItem'] { min-height: 48px; font-size: 16px !important; }",
    "}",
  ].join("\n");
  document.head.appendChild(style);

  // The Category field is a searchable drop-down: tapping it put a text cursor
  // in and brought up the keyboard. It only has five fixed choices, so make it
  // a pure picker. A read-only input still opens the list on tap, but never
  // shows the keyboard. Checked again whenever Decap redraws the form.
  var lockTimer = null;
  function lockPickers() {
    lockTimer = null;
    var boxes = document.querySelectorAll("[class*='ControlContainer'] input[aria-autocomplete='list']");
    for (var i = 0; i < boxes.length; i++) {
      if (!boxes[i].readOnly) {
        boxes[i].readOnly = true;
        boxes[i].setAttribute("inputmode", "none");
      }
    }
  }
  // The "Quick post" shortcut: shown on the recipe list screens only (not inside
  // an editor, and not on the login screen, which has no header).
  var fab = document.createElement("a");
  fab.className = "dd-fab";
  fab.href = "/quick/";
  fab.textContent = "+ Quick post";
  fab.hidden = true;
  document.body.appendChild(fab);
  function syncFab() {
    var onList = /^#\/?(collections\/[^\/]+)?\/?$/.test(location.hash);
    var signedIn = !!document.querySelector("header[class*='AppHeader']");
    fab.hidden = !(onList && signedIn);
  }
  window.addEventListener("hashchange", syncFab);

  // Decap opens every drop-down flush with the LEFT edge of its button. Near the
  // right edge of a phone that runs off the screen and makes the page scroll
  // sideways (Group by, Publish). Whenever a menu is open, flip it to open
  // leftward if it overflows on the right, and keep it inside on the left too.
  function fitMenus() {
    var menus = document.querySelectorAll("[class*='DropdownList']");
    for (var i = 0; i < menus.length; i++) {
      var m = menus[i];
      m.style.left = "";
      m.style.right = "";
      var r = m.getBoundingClientRect();
      if (!r.width) continue;
      var edge = document.documentElement.clientWidth - 8;
      if (r.right > edge) {
        m.style.left = "auto";
        m.style.right = "0";
        r = m.getBoundingClientRect();
        if (r.left < 8) { m.style.left = "0"; m.style.right = "auto"; m.style.maxWidth = (edge - 8) + "px"; }
      }
    }
  }

  new MutationObserver(function () {
    fitMenus(); // right away, before the browser paints, so a menu never shows overflowing first
    if (!lockTimer) lockTimer = setTimeout(function () { lockPickers(); syncFab(); }, 50);
  }).observe(document.body, { childList: true, subtree: true });

  var favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/png";
  favicon.href = "https://thedeliciousdaily.com/favicon-light.png";
  document.head.appendChild(favicon);
})();

// A small surprise: searching for "paulette" in any search box opens a bouquet.
// bloom.js is only fetched at that moment, so the admin loads exactly as before.
(function () {
  var armed = true;   // fires once per typing of the word, not on every keystroke after
  var loading = false;
  function show() {
    if (window.Bloom) { window.Bloom.open(); return; }
    if (loading) return;
    loading = true;
    var tag = document.createElement("script");
    tag.src = "/bloom.js?v=6";
    tag.onload = function () { loading = false; if (window.Bloom) window.Bloom.open(); };
    tag.onerror = function () { loading = false; armed = true; };
    document.head.appendChild(tag);
  }
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!el || el.tagName !== "INPUT" || !/search/i.test(el.placeholder || "")) return;
    if (el.value.trim().toLowerCase() !== "paulette") { armed = true; return; }
    if (!armed) return;
    armed = false;
    show();
  }, true);
})();
