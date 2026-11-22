// Photo library for the CMS. Replaces Decap's built-in media library, which
// draws its grid with a "virtualised" list (every tile's position is computed in
// JavaScript), so it can't be made two-column or cleanly responsive with CSS and
// hid its own Delete button on a phone.
//
// What this one does:
//   - a two-column grid of square thumbnails (more across on a wider screen)
//   - uploads are resized to ONE standard size before they are saved:
//     1600px wide, cropped to 4:3 (the shape the site shows photos in), JPEG.
//     The crop can be switched off for a single batch.
//   - search, select, "Use this photo", copy path, delete — all always visible
//
// It talks to the GitHub API with the same sign-in token the CMS already holds
// (the one the OAuth worker issued), straight to the repo's images folder, the
// same place the built-in library wrote to. Registered in config.yml as
// `media_library: { name: dd-photos }`.
//
// The resizing and GitHub helpers are also exposed as window.DDPhotoTools, for
// the Quick post page.
//
// For local testing a page can set window.DD_PHOTOS_TEST = { api, token } to
// point it at a fake GitHub.

(function () {
  var TEST = window.DD_PHOTOS_TEST || null;
  var API = (TEST && TEST.api) || "https://api.github.com";
  var MAX_WIDTH = 1600;
  var RATIO = 4 / 3;
  var JPEG_QUALITY = 0.82;
  var IMAGE_NAME = /\.(jpe?g|png|webp|gif|avif)$/i;
  // The site's own artwork lives in the same folder; keep it out of the library.
  var SITE_ART = /^(app-icon-|apple-touch-icon|logo-mark|og-default)/i;

  // ---------------------------------------------------------------- styles
  var css = [
    ".ddp-overlay{position:fixed;left:0;right:0;top:0;height:100vh;height:100dvh;z-index:99999;background:rgba(42,38,32,.6);display:flex;align-items:flex-end;justify-content:center;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#2a2620;-webkit-tap-highlight-color:transparent}",
    ".ddp-overlay *{-webkit-tap-highlight-color:transparent}",
    ".ddp-overlay button:focus,.ddp-sheet:focus{outline:none;box-shadow:none}",
    ".ddp-sheet{background:#fffdf6;width:100%;max-width:1000px;height:100%;display:flex;flex-direction:column;position:relative;min-height:0}",
    "@media(min-width:800px){.ddp-overlay{align-items:center}.ddp-sheet{height:90vh;border-radius:3px;box-shadow:0 30px 70px -20px rgba(42,38,32,.6)}}",
    ".ddp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(12px + env(safe-area-inset-top)) 18px 12px;border-bottom:2px dashed rgba(168,85,58,.45)}",
    ".ddp-head h2{margin:0;font:600 20px 'IBM Plex Mono',ui-monospace,monospace}",
    ".ddp-close{min-width:44px;min-height:44px;border:1.5px solid #ddd3ba;background:#fffdf6;border-radius:2px;font-size:20px;cursor:pointer;color:#2a2620}",
    ".ddp-tools{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;padding:10px 16px 0}",
    ".ddp-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border:1.5px solid #2a2620;background:#fffdf6;color:#2a2620;border-radius:2px;font:500 14px 'IBM Plex Mono',ui-monospace,monospace;cursor:pointer;text-align:center}",
    ".ddp-btn:disabled{opacity:.4;cursor:default}",
    ".ddp-primary{background:#a8553a;border-color:#8a3f27;color:#fff;box-shadow:2px 2px 0 #2a2620}",
    ".ddp-danger{border-color:#a32d2d;color:#a32d2d}",
    ".ddp-check{flex:1 1 100%;display:flex;align-items:center;gap:8px;font-size:13px;color:#5f564a}",
    ".ddp-check input{width:20px;height:20px;accent-color:#a8553a}",
    ".ddp-search{flex:1 1 140px;min-width:0;min-height:44px;padding:0 14px;background:#fffdf6;border:1.5px solid #ddd3ba;border-bottom:2px solid #b8aa88;border-radius:2px;font:400 16px 'IBM Plex Sans',system-ui,sans-serif;color:#2a2620}",
    ".ddp-search:focus,.ddp-btn:focus-visible,.ddp-tile:focus-visible,.ddp-close:focus-visible{outline:2px solid #a8553a;outline-offset:2px}",
    ".ddp-status{min-height:20px;padding:2px 16px 4px;font-size:13px;color:#5f564a}",
    ".ddp-status.ddp-error{color:#a32d2d}",
    ".ddp-grid{flex:1;overflow:auto;padding:8px 16px 16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start;grid-auto-rows:max-content;background:#f7f1e3}",
    "@media(min-width:640px){.ddp-grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}}",
    ".ddp-tile{position:relative;display:block;padding:0;border:2px solid #ddd3ba;background:#fffdf6;border-radius:3px;text-align:left;cursor:pointer;color:#2a2620;font:inherit}",
    /* a padding-top square, not aspect-ratio: inside a button in a grid, an
       aspect-ratio image measures as zero height and the rows collapse */
    ".ddp-thumbbox{position:relative;display:block;width:100%;padding-top:100%;background:#efe7d9;overflow:hidden}",
    ".ddp-thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
    ".ddp-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;padding:6px 8px 8px;font-size:12px;line-height:1.3;color:#5f564a}",
    ".ddp-tile[aria-pressed='true']{border-color:#a8553a;box-shadow:0 0 0 3px rgba(168,85,58,.28)}",
    ".ddp-tile[aria-pressed='true']::after{content:'\\2713';position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:#a8553a;color:#fff;font-size:17px;line-height:28px;text-align:center}",
    ".ddp-empty{grid-column:1/-1;text-align:center;padding:40px 0;color:#5f564a}",
    ".ddp-foot{display:flex;gap:10px;padding:12px 18px max(22px,calc(14px + env(safe-area-inset-bottom)));border-top:2px dashed rgba(168,85,58,.45);background:#fffdf6}",
    ".ddp-foot .ddp-btn{flex:1 1 0;min-width:0;padding:0 6px;font-size:13px;box-shadow:none}",
    ".ddp-foot .ddp-primary{border-color:#8a3f27}",
  ].join("\n");
  var styleEl = null;
  function ensureStyle() {
    if (styleEl) return;
    styleEl = document.createElement("style");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // -------------------------------------------------------------- GitHub API
  function token() {
    if (TEST) return TEST.token;
    var keys = ["decap-cms-user", "netlify-cms-user"];
    for (var i = 0; i < keys.length; i++) {
      try {
        var user = JSON.parse(localStorage.getItem(keys[i]));
        if (user && user.token) return user.token;
      } catch (e) { /* try the next key */ }
    }
    return "";
  }

  function gh(path, opts) {
    opts = opts || {};
    var headers = { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json" };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.message || "GitHub answered " + res.status);
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function explain(err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return "GitHub didn't accept your sign-in (it may have expired). Sign out, sign back in, and try again.";
    }
    return "Something went wrong: " + (err && err.message ? err.message : "unknown error");
  }

  // ------------------------------------------------------------ image resize
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file couldn't be read as a photo.")); };
      img.src = url;
    });
  }

  // One standard size: centre-cropped to 4:3 (optional), at most 1600px wide,
  // JPEG. Never enlarges a smaller photo.
  function standardise(file, crop) {
    return loadImage(file).then(function (img) {
      var sw = img.naturalWidth, sh = img.naturalHeight;
      var sx = 0, sy = 0, cw = sw, ch = sh;
      if (crop) {
        var r = sw / sh;
        if (r > RATIO) { cw = Math.round(sh * RATIO); sx = Math.round((sw - cw) / 2); }
        else if (r < RATIO) { ch = Math.round(sw / RATIO); sy = Math.round((sh - ch) / 2); }
      }
      var scale = Math.min(1, MAX_WIDTH / cw);
      var w = Math.max(1, Math.round(cw * scale));
      var h = Math.max(1, Math.round(ch * scale));
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // transparent PNGs would otherwise turn black as JPEG
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, sx, sy, cw, ch, 0, 0, w, h);
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("Couldn't prepare that photo.")); }, "image/jpeg", JPEG_QUALITY);
      });
    });
  }

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(",")[1]); };
      reader.onerror = function () { reject(new Error("Couldn't read the photo.")); };
      reader.readAsDataURL(blob);
    });
  }

  function slugName(original, taken) {
    var base = original.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "photo";
    var name = base + ".jpg";
    var n = 2;
    while (taken[name]) name = base + "-" + n++ + ".jpg";
    return name;
  }

  // Shared with the Quick post page (admin/quick/), which has no CMS around it.
  window.DDPhotoTools = {
    token: token, gh: gh, explain: explain, standardise: standardise, toBase64: toBase64, slugName: slugName,
  };

  if (typeof CMS === "undefined" || !CMS.registerMediaLibrary) return; // not running inside the CMS

  // ------------------------------------------------------------------- the UI
  var overlay = null;

  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === "text") node.textContent = props[k];
      else if (k === "class") node.className = props[k];
      else node.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function close() {
    if (!overlay) return;
    document.removeEventListener("keydown", overlay._onKey, true);
    overlay.remove();
    overlay = null;
    document.body.style.overflow = overlay_prevOverflow;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  var overlay_prevOverflow = "";
  var lastFocus = null;

  function open(cfg, handleInsert, opts) {
    if (overlay) close();
    ensureStyle();
    var repo = cfg.repo || "Bash328/TheDeliciousDailyFood";
    var branch = cfg.branch || "main";
    var folder = cfg.folder || "images";
    var publicFolder = (cfg.public_folder || "/images").replace(/\/$/, "");
    var fieldMode = !!(opts && Object.keys(opts).length); // opened from a photo field, not the Media tab

    var items = []; // { name, sha, url }
    var selected = {}; // name -> true
    var filter = "";
    var busy = false;

    var statusEl = el("div", { class: "ddp-status", role: "status" });
    var grid = el("div", { class: "ddp-grid" });
    var search = el("input", { class: "ddp-search", type: "search", placeholder: "Search photos…", "aria-label": "Search photos" });
    var fileInput = el("input", { type: "file", accept: "image/*", multiple: "multiple", hidden: "hidden" });
    var cropBox = el("input", { type: "checkbox", id: "ddp-crop" });
    try { cropBox.checked = localStorage.getItem("ddp-crop") !== "off"; } catch (e) { cropBox.checked = true; }
    cropBox.addEventListener("change", function () {
      try { localStorage.setItem("ddp-crop", cropBox.checked ? "on" : "off"); } catch (e) { /* not remembered */ }
    });
    var uploadBtn = el("button", { class: "ddp-btn ddp-primary", type: "button", text: "Upload" });
    var useBtn = el("button", { class: "ddp-btn ddp-primary", type: "button", text: "Use photo" });
    var copyBtn = el("button", { class: "ddp-btn", type: "button", text: "Copy path" });
    var delBtn = el("button", { class: "ddp-btn ddp-danger", type: "button", text: "Delete" });
    var closeBtn = el("button", { class: "ddp-close", type: "button", "aria-label": "Close", text: "✕" });

    var foot = el("div", { class: "ddp-foot" }, [fieldMode ? useBtn : null, copyBtn, delBtn]);
    var sheet = el("div", { class: "ddp-sheet" }, [
      el("div", { class: "ddp-head" }, [el("h2", { text: "Photos" }), closeBtn]),
      el("div", { class: "ddp-tools" }, [
        uploadBtn,
        search,
        el("label", { class: "ddp-check", for: "ddp-crop" }, [cropBox, el("span", { text: "Crop uploads to 4:3 (matches the site)" })]),
      ]),
      statusEl,
      grid,
      foot,
    ]);
    overlay = el("div", { class: "ddp-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Photo library" }, [sheet, fileInput]);

    function say(text, isError) {
      statusEl.textContent = text || "";
      statusEl.className = "ddp-status" + (isError ? " ddp-error" : "");
    }
    function selectedNames() { return Object.keys(selected); }

    function refreshButtons() {
      var n = selectedNames().length;
      useBtn.disabled = busy || n !== 1;
      copyBtn.disabled = busy || n !== 1;
      delBtn.disabled = busy || n === 0;
      delBtn.textContent = n > 1 ? "Delete " + n : "Delete";
      uploadBtn.disabled = busy;
    }

    function render() {
      grid.textContent = "";
      var shown = items.filter(function (it) { return !filter || it.name.toLowerCase().indexOf(filter) !== -1; });
      if (!shown.length) {
        grid.appendChild(el("div", { class: "ddp-empty", text: items.length ? "No photos match that search." : "No photos yet. Tap Upload photos." }));
      }
      shown.forEach(function (it) {
        var img = el("img", { class: "ddp-thumb", src: it.url, alt: "", loading: "lazy", decoding: "async" });
        var tile = el("button", { class: "ddp-tile", type: "button", "aria-pressed": selected[it.name] ? "true" : "false", "aria-label": it.name }, [el("span", { class: "ddp-thumbbox" }, [img]), el("span", { class: "ddp-name", text: it.name })]);
        tile.addEventListener("click", function () {
          if (fieldMode) selected = {};
          if (selected[it.name]) delete selected[it.name]; else selected[it.name] = true;
          render();
        });
        grid.appendChild(tile);
      });
      refreshButtons();
    }

    function load() {
      say("Loading photos…");
      gh("/repos/" + repo + "/contents/" + folder + "?ref=" + encodeURIComponent(branch)).then(function (list) {
        items = (Array.isArray(list) ? list : [])
          .filter(function (f) { return f.type === "file" && IMAGE_NAME.test(f.name) && !SITE_ART.test(f.name); })
          .map(function (f) { return { name: f.name, sha: f.sha, url: f.download_url }; })
          .sort(function (a, b) { return a.name.localeCompare(b.name); });
        say(items.length + (items.length === 1 ? " photo" : " photos"));
        render();
      }).catch(function (err) { say(explain(err), true); });
    }

    function upload(files) {
      var list = Array.prototype.slice.call(files);
      if (!list.length) return;
      busy = true;
      refreshButtons();
      var crop = cropBox.checked;
      var taken = {};
      items.forEach(function (it) { taken[it.name] = true; });
      var done = 0, failed = 0;
      var chain = Promise.resolve();
      list.forEach(function (file) {
        chain = chain.then(function () {
          say("Preparing and uploading " + (done + failed + 1) + " of " + list.length + "…");
          return standardise(file, crop).then(function (blob) {
            var name = slugName(file.name, taken);
            taken[name] = true;
            return toBase64(blob).then(function (b64) {
              return gh("/repos/" + repo + "/contents/" + folder + "/" + name, {
                method: "PUT",
                body: { message: "Add photo " + name, content: b64, branch: branch },
              }).then(function (res) {
                var content = res && res.content ? res.content : {};
                items.push({ name: name, sha: content.sha, url: content.download_url || (publicFolder + "/" + name) });
                items.sort(function (a, b) { return a.name.localeCompare(b.name); });
                if (fieldMode) selected = {};
                selected[name] = true;
                done++;
              });
            });
          }).catch(function (err) { failed++; say(explain(err), true); });
        });
      });
      chain.then(function () {
        busy = false;
        if (!failed) say(done + (done === 1 ? " photo" : " photos") + " added at the standard size.");
        render();
        // an uploaded photo is the one you most likely want next to the field
        var n = selectedNames();
        if (n.length) {
          var tile = grid.querySelector(".ddp-tile[aria-pressed='true']");
          if (tile && tile.scrollIntoView) tile.scrollIntoView({ block: "nearest" });
        }
      });
    }

    function removeSelected() {
      var names = selectedNames();
      if (!names.length) return;
      var msg = names.length === 1
        ? "Delete " + names[0] + "? A recipe using this photo will show a plain placeholder until you give it another."
        : "Delete " + names.length + " photos? Recipes using them will show a plain placeholder until you give them another.";
      if (!window.confirm(msg)) return;
      busy = true;
      refreshButtons();
      var chain = Promise.resolve();
      names.forEach(function (name) {
        chain = chain.then(function () {
          var it = items.filter(function (x) { return x.name === name; })[0];
          return gh("/repos/" + repo + "/contents/" + folder + "/" + name, {
            method: "DELETE",
            body: { message: "Delete photo " + name, sha: it && it.sha, branch: branch },
          }).then(function () {
            items = items.filter(function (x) { return x.name !== name; });
            delete selected[name];
          }).catch(function (err) { say(explain(err), true); });
        });
      });
      chain.then(function () {
        busy = false;
        if (!statusEl.classList.contains("ddp-error")) say("Deleted " + names.length + (names.length === 1 ? " photo." : " photos."));
        render();
      });
    }

    uploadBtn.addEventListener("click", function () { fileInput.value = ""; fileInput.click(); });
    fileInput.addEventListener("change", function () { upload(fileInput.files); });
    search.addEventListener("input", function () { filter = search.value.trim().toLowerCase(); render(); });
    closeBtn.addEventListener("click", close);
    delBtn.addEventListener("click", removeSelected);
    copyBtn.addEventListener("click", function () {
      var name = selectedNames()[0];
      var path = publicFolder + "/" + name;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(path).then(function () { say("Copied " + path); }, function () { say(path); });
      } else { say(path); }
    });
    useBtn.addEventListener("click", function () {
      var name = selectedNames()[0];
      if (!name) return;
      handleInsert(publicFolder + "/" + name);
      close();
    });
    overlay._onKey = function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", overlay._onKey, true);

    lastFocus = document.activeElement;
    overlay_prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.appendChild(overlay);
    sheet.setAttribute("tabindex", "-1");
    sheet.focus({ preventScroll: true }); // keyboard and screen readers land inside, with no ring on the X
    refreshButtons();
    load();
  }

  CMS.registerMediaLibrary({
    name: "dd-photos",
    init: function (args) {
      var cfg = (args && args.options && args.options.config) || {};
      var handleInsert = args && args.handleInsert;
      return {
        show: function (opts) { open(cfg, handleInsert, opts); },
        hide: close,
        onClearControl: function () {},
        onRemoveControl: function () {},
        enableStandalone: function () { return true; },
      };
    },
  });
})();
