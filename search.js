// Homepage recipe search. The list (/search.json, built from search-index.njk)
// is fetched the first time the box is used, so the homepage stays light.
// Every word typed must match the title, cuisine, course or an ingredient;
// title matches rank first. All in the browser, nothing sent anywhere.
(function () {
  var input = document.getElementById("recipe-search");
  if (!input) return;
  var results = document.getElementById("recipe-search-results");
  var status = document.getElementById("recipe-search-status");
  var MAX = 30;
  var recipes = null, loading = null;

  var fold = function (s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  // "chick" matches "chicken" and "Thai Chicken", but "ice" doesn't match "rice"
  var hasWord = function (text, w) { return text.indexOf(w) === 0 || text.indexOf(" " + w) >= 0 || text.indexOf("(" + w) >= 0 || text.indexOf("-" + w) >= 0; };

  function load() {
    if (!loading) {
      loading = fetch("/search.json")
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          recipes = rows.map(function (r) {
            return { title: r[0], url: r[1], meta: r[2], t: fold(r[0]), rest: fold([r[3], r[4], r[5]].join(" , ")) };
          });
        })
        .catch(function () { loading = null; status.textContent = "Search couldn't load. Check your connection and try again."; });
    }
    return loading;
  }

  function score(r, q, words) {
    var s = 0;
    for (var i = 0; i < words.length; i++) {
      if (hasWord(r.t, words[i])) s += 3;
      else if (hasWord(r.rest, words[i])) s += 1;
      else return 0;
    }
    if (r.t.indexOf(q) === 0) s += 5;
    return s;
  }

  function show() {
    var q = fold(input.value.trim().replace(/\s+/g, " "));
    results.innerHTML = "";
    if (!q) { results.hidden = true; status.textContent = ""; return; }
    if (!recipes) { load().then(show); return; }
    var words = q.split(" ");
    var hits = recipes
      .map(function (r) { return { r: r, s: score(r, q, words) }; })
      .filter(function (h) { return h.s; })
      .sort(function (a, b) { return b.s - a.s || a.r.title.localeCompare(b.r.title); });

    hits.slice(0, MAX).forEach(function (h) {
      var a = document.createElement("a");
      a.className = "row";
      a.href = h.r.url;
      var text = document.createElement("div");
      text.className = "row-text";
      var t = document.createElement("h3");
      t.textContent = h.r.title;
      var m = document.createElement("span");
      m.className = "meta";
      m.textContent = h.r.meta;
      text.appendChild(t);
      text.appendChild(m);
      a.appendChild(text);
      results.appendChild(a);
    });
    results.hidden = !hits.length;
    status.textContent = !hits.length
      ? "No recipes match “" + input.value.trim() + "”. Try one ingredient, like chicken or rice."
      : hits.length > MAX
        ? "Showing the top " + MAX + " of " + hits.length + " recipes. Add a word to narrow it down."
        : hits.length + (hits.length === 1 ? " recipe" : " recipes");
  }

  var timer;
  var clearBtn = document.getElementById("recipe-search-clear");
  function syncClear() { if (clearBtn) clearBtn.hidden = !input.value; }
  if (clearBtn) clearBtn.addEventListener("click", function () { input.value = ""; syncClear(); show(); input.focus(); });
  input.addEventListener("input", syncClear);
  // A small surprise: searching for "paulette" opens a bouquet (same one as in the admin).
  // bloom.js is only fetched at that moment, so the page weighs exactly what it did.
  var bloomArmed = true, bloomLoading = false;
  function bloom() {
    if (window.Bloom) { window.Bloom.open(); return; }
    if (bloomLoading) return;
    bloomLoading = true;
    var tag = document.createElement("script");
    tag.src = "/bloom.js?v=6";
    tag.onload = function () { bloomLoading = false; if (window.Bloom) window.Bloom.open(); };
    tag.onerror = function () { bloomLoading = false; bloomArmed = true; };
    document.head.appendChild(tag);
  }
  input.addEventListener("input", function () {
    if (input.value.trim().toLowerCase() !== "paulette") { bloomArmed = true; return; }
    if (!bloomArmed) return;
    bloomArmed = false;
    bloom();
  });

  input.addEventListener("focus", load, { once: true });
  input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(show, 120); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { input.value = ""; syncClear(); show(); }
    // Enter opens the top result
    if (e.key === "Enter") {
      e.preventDefault();
      var first = results.querySelector("a");
      if (first && !results.hidden) location.href = first.href;
    }
  });
  // coming Back to the homepage can restore the typed text; show its results again
  syncClear();
  if (input.value.trim()) show();
})();
