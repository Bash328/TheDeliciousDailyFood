// My Kitchen page (/my-kitchen/). The ingredient list and swaps come from
// lib/kitchen.js via the #k-data block; each recipe row in #k-pool carries its
// ingredient lines (data-k) as ingredient ids. What you pick is saved in this
// browser only (localStorage), like the grocery list.
(function () {
  var STORE = "ddKitchen";
  var MAX_MISSING = 3;
  var data = JSON.parse(document.getElementById("k-data").textContent);
  var names = data.items.map(function (x) { return x[0]; });
  var staples = data.staples;
  var $ = function (id) { return document.getElementById(id); };
  var search = $("k-search"), suggest = $("k-suggest"), chosenEl = $("k-chosen");
  var staplesBox = $("k-staples"), results = $("k-results"), status = $("k-status");

  // ---- saved state: picked ingredients by name, so a renamed id never mixes them up
  var have = new Set();
  try {
    var saved = JSON.parse(localStorage.getItem(STORE)) || {};
    (saved.have || []).forEach(function (n) { var i = names.indexOf(n); if (i >= 0) have.add(i); });
    if (saved.staples === false) staplesBox.checked = false;
  } catch (e) { /* nothing saved, or storage blocked */ }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        have: Array.from(have).map(function (i) { return names[i]; }),
        staples: staplesBox.checked,
      }));
    } catch (e) { /* private mode or full: keeps working for this visit */ }
  }

  // ---- search
  var fold = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  var haystack = names.map(function (n, i) {
    return { name: fold(n), words: data.words[i].split(",").map(function (w) { return fold(w.trim()); }).filter(Boolean) };
  });
  var startsWord = function (text, q) { return text.indexOf(q) === 0 || text.indexOf(" " + q) >= 0; };

  function findMatches(q) {
    q = fold(q.trim());
    if (!q) return [];
    var hits = [];
    haystack.forEach(function (h, i) {
      // "tomato" should land on Tomatoes, not Tomato paste
      var exact = [h.name].concat(h.words).some(function (w) { return w === q || w === q + "s" || w === q + "es"; });
      var rank = exact ? 0 : h.name.indexOf(q) === 0 ? 1 : startsWord(h.name, q) ? 2 : -1;
      var alias = null;
      if (rank < 0) {
        for (var w = 0; w < h.words.length; w++) {
          if (startsWord(h.words[w], q)) { rank = 3; alias = data.words[i].split(",")[w].trim(); break; }
        }
      }
      if (rank < 0 && q.length >= 3 && h.name.indexOf(q) > 0) rank = 4;
      if (rank >= 0) hits.push({ id: i, rank: rank, alias: alias });
    });
    hits.sort(function (a, b) { return a.rank - b.rank || names[a.id].localeCompare(names[b.id]); });
    return hits.slice(0, 8);
  }

  var active = -1;
  function showSuggestions() {
    var hits = findMatches(search.value);
    suggest.innerHTML = "";
    active = -1;
    if (!search.value.trim()) { closeSuggestions(); return; }
    if (!hits.length) {
      var none = document.createElement("li");
      none.className = "kitchen-none";
      none.textContent = "No ingredient called that yet.";
      suggest.appendChild(none);
    }
    hits.forEach(function (h, n) {
      var li = document.createElement("li");
      li.id = "k-opt-" + n;
      li.setAttribute("role", "option");
      li.dataset.id = h.id;
      li.setAttribute("aria-selected", "false");
      li.textContent = names[h.id];
      if (h.alias) {
        var a = document.createElement("span");
        a.className = "kitchen-alias";
        a.textContent = " (" + h.alias + ")";
        li.appendChild(a);
      }
      if (have.has(h.id)) {
        var t = document.createElement("span");
        t.className = "kitchen-tick";
        t.textContent = " ✓ added";
        li.appendChild(t);
      }
      // mousedown, not click: the input would lose focus first and close the list
      li.addEventListener("mousedown", function (e) { e.preventDefault(); pick(h.id); });
      suggest.appendChild(li);
    });
    suggest.hidden = false;
    search.setAttribute("aria-expanded", "true");
  }

  function closeSuggestions() {
    suggest.hidden = true;
    search.setAttribute("aria-expanded", "false");
    search.removeAttribute("aria-activedescendant");
  }

  function moveActive(step) {
    var opts = suggest.querySelectorAll("[role=option]");
    if (!opts.length) return;
    if (active >= 0) opts[active].setAttribute("aria-selected", "false");
    active = (active + step + opts.length) % opts.length;
    opts[active].setAttribute("aria-selected", "true");
    search.setAttribute("aria-activedescendant", opts[active].id);
    opts[active].scrollIntoView({ block: "nearest" });
  }

  search.addEventListener("input", showSuggestions);
  search.addEventListener("focus", function () { if (search.value.trim()) showSuggestions(); });
  search.addEventListener("blur", closeSuggestions);
  search.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); if (suggest.hidden) showSuggestions(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Escape") { closeSuggestions(); }
    else if (e.key === "Enter") {
      e.preventDefault();
      var opts = suggest.querySelectorAll("[role=option]");
      var opt = opts[active >= 0 ? active : 0];
      if (opt && !suggest.hidden) pick(Number(opt.dataset.id));
    }
  });

  // Picking from search adds it (or takes it off if it was already there), then
  // clears the box ready for the next one.
  function pick(id) {
    toggle(id);
    say((have.has(id) ? "Added " : "Removed ") + names[id] + ".");
    search.value = "";
    closeSuggestions();
    search.focus();
  }

  function toggle(id, on) {
    if (on === undefined) on = !have.has(id);
    if (on) have.add(id); else have.delete(id);
    save();
    render();
  }

  // ---- chosen chips + browse list
  var browseBtns = [];
  (function buildBrowse() {
    var box = $("k-browse"), group = null, wrap;
    data.items.forEach(function (x, i) {
      if (x[1] !== group) {
        group = x[1];
        var h = document.createElement("h3");
        h.className = "kitchen-group";
        h.textContent = group;
        wrap = document.createElement("div");
        wrap.className = "kitchen-chips";
        box.appendChild(h);
        box.appendChild(wrap);
      }
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kitchen-chip";
      b.textContent = names[i];
      b.addEventListener("click", function () { toggle(i); });
      browseBtns[i] = b;
      wrap.appendChild(b);
    });
  })();

  function render() {
    chosenEl.innerHTML = "";
    var list = Array.from(have).sort(function (a, b) { return names[a].localeCompare(names[b]); });
    list.forEach(function (id) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kitchen-chip is-on";
      b.setAttribute("aria-label", "Remove " + names[id]);
      b.textContent = names[id] + " ×";
      b.addEventListener("click", function () {
        var next = li.nextElementSibling || li.previousElementSibling;
        toggle(id, false);
        // keep keyboard focus nearby instead of dropping it on <body>
        var target = next && chosenEl.querySelector('[aria-label="' + next.firstChild.getAttribute("aria-label") + '"]');
        (target || search).focus();
      });
      li.appendChild(b);
      chosenEl.appendChild(li);
    });
    $("k-count").textContent = list.length;
    $("k-empty").hidden = list.length > 0;
    browseBtns.forEach(function (b, i) { b.setAttribute("aria-pressed", have.has(i) ? "true" : "false"); });
    if (!results.hidden) cook(false);
  }

  // ---- what can I make
  var pool = Array.from(document.querySelectorAll("#k-pool .row")).map(function (row) {
    return { row: row, k: JSON.parse(row.dataset.k) };
  });
  var isStaple = function (id) { return staples.indexOf(id) >= 0; };
  var listNames = function (g) { return g.map(function (id) { return names[id].toLowerCase(); }).join(" or "); };

  function check(k, owned) {
    var got = 0, mine = false, missing = [], swaps = [];
    k.n.forEach(function (g) {
      if (g.some(function (id) { return owned.has(id); })) {
        got++;
        if (g.some(function (id) { return have.has(id) && !isStaple(id); })) mine = true;
        return;
      }
      var swap = null, tips = [];
      data.swaps.forEach(function (s) {
        if (g.indexOf(s[0]) < 0) return;
        if (!swap && owned.has(s[1])) swap = s;
        else if (tips.length < 2) tips.push(s[2]);
      });
      if (swap) swaps.push({ miss: names[swap[0]].toLowerCase(), how: swap[2] });
      else missing.push({ name: listNames(g), tips: tips });
    });
    k.x.forEach(function (text) { missing.push({ name: text, tips: [] }); });
    return { mine: mine, got: got + swaps.length, total: k.n.length + k.x.length, missing: missing, swaps: swaps };
  }

  function note(r) {
    var p = document.createElement("p");
    p.className = "kitchen-note";
    var head = document.createElement("strong");
    head.textContent = r.missing.length ? "You have " + r.got + " of " + r.total + "." : "You have everything" + (r.swaps.length ? " with a swap." : ".");
    p.appendChild(head);
    if (r.missing.length) {
      var m = document.createElement("span");
      m.className = "kitchen-miss";
      m.textContent = "Missing: " + r.missing.map(function (x) {
        return x.name + (x.tips.length ? " (or use " + x.tips.join("; or ") + ")" : "");
      }).join(", ");
      p.appendChild(m);
    }
    r.swaps.forEach(function (s) {
      var w = document.createElement("span");
      w.className = "kitchen-swap";
      w.textContent = "Swap: no " + s.miss + "? Use " + s.how + ".";
      p.appendChild(w);
    });
    return p;
  }

  function cook(scroll) {
    var owned = new Set(have);
    if (staplesBox.checked) staples.forEach(function (id) { owned.add(id); });
    var hits = [];
    pool.forEach(function (p) {
      var r = check(p.k, owned);
      if (r.mine && r.missing.length <= MAX_MISSING) hits.push({ p: p, r: r });
    });
    hits.sort(function (a, b) {
      return a.r.missing.length - b.r.missing.length || a.r.swaps.length - b.r.swaps.length || b.r.got / b.r.total - a.r.got / a.r.total;
    });

    results.innerHTML = "";
    var title = document.createElement("h2");
    title.className = "kitchen-results-title";
    title.tabIndex = -1;
    results.appendChild(title);
    if (!have.size) {
      title.textContent = "Add a few ingredients first";
    } else if (!hits.length) {
      title.textContent = "Nothing quite fits yet";
      var tip = document.createElement("p");
      tip.className = "intro";
      tip.textContent = "Try adding a few more things you have: an onion, eggs, rice or pasta opens up a lot of recipes.";
      results.appendChild(tip);
    } else {
      title.textContent = hits.length + (hits.length === 1 ? " recipe" : " recipes") + " you can make";
    }

    var labels = ["Ready to cook", "Missing 1 thing", "Missing 2 things", "Missing 3 things"];
    var rows = null, last = -1;
    hits.forEach(function (h) {
      var n = h.r.missing.length;
      if (n !== last) {
        last = n;
        var hd = document.createElement("h3");
        hd.className = "pick-heading";
        hd.textContent = labels[n];
        var c = document.createElement("span");
        c.className = "small-caps";
        c.textContent = hits.filter(function (x) { return x.r.missing.length === n; }).length;
        hd.appendChild(c);
        rows = document.createElement("div");
        rows.className = "rows";
        results.appendChild(hd);
        results.appendChild(rows);
      }
      var old = h.p.row.querySelector(".kitchen-note");
      if (old) old.remove();
      h.p.row.querySelector(".row-text").appendChild(note(h.r));
      var item = document.createElement("div");
      item.className = "kitchen-hit";
      item.appendChild(h.p.row);
      if (n && window.DDGroceryList) item.appendChild(groceryButton(h.r));
      rows.appendChild(item);
    });

    results.hidden = false;
    if (scroll) {
      title.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      title.focus({ preventScroll: true });
    }
  }

  function groceryButton(r) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-small";
    b.textContent = "Add missing to grocery list";
    b.addEventListener("click", function () {
      window.DDGroceryList.addItems(r.missing.map(function (x) { return x.name; }));
      b.textContent = "Added to grocery list";
      b.disabled = true;
      say("Added " + r.missing.length + " to your grocery list.");
    });
    return b;
  }

  function say(text) { status.textContent = text; }

  $("k-go").addEventListener("click", function () { cook(true); });
  staplesBox.addEventListener("change", function () { save(); render(); });
  $("k-clear").addEventListener("click", function () {
    if (!have.size || !confirm("Clear everything in My Kitchen?")) return;
    have.clear();
    save();
    results.hidden = true;
    render();
    say("Cleared.");
  });

  render();
})();
