// Accounts on the public site: a "Save recipe" button on recipe pages, the
// /account/ page (sign in, saved recipes, delete account), and syncing the
// grocery list between devices. Talks to the API in ../api-worker.
//
// Loaded on every page by partials/app-script.njk, but only when
// site.accountsApi is set. Until someone signs in, the only thing this does on
// a page is add the Save button; it makes no network request, so visitors who
// never sign in are never sent to the API.
//
// Markup lives in the templates (account.njk) so it can be restyled freely;
// this file only looks things up by id / data-attribute.
(function () {
  var API = window.DD_API;
  if (!API) return;

  var SIGNED_IN = "ddSignedIn"; // "1" once this browser has signed in
  var DIRTY = "ddGroceryDirty"; // "1" while local grocery edits haven't reached the server
  var signedIn = read(SIGNED_IN) === "1";

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* private mode: the account still works, just per page */ }
  }
  function noop() {}

  function api(path, method, body) {
    return fetch(API + path, {
      method: method || "GET",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) { signedIn = false; write(SIGNED_IN, null); }
        if (!res.ok) { var err = new Error(data.error || "request failed"); err.body = data; throw err; }
        return data;
      });
    });
  }

  var mePromise = null;
  function me() {
    if (!signedIn) return Promise.resolve(null);
    if (!mePromise) mePromise = api("/me").catch(function () { return null; });
    return mePromise;
  }

  // ---------------------------------------------------------------- grocery
  var G = window.DDGroceryList;
  var applying = false; // true while we write the server's copy into local storage
  var pushTimer = null;

  function replaceLocal(items) {
    applying = true;
    G.writeList(items);
    applying = false;
    window.dispatchEvent(new Event("dd:grocery-synced"));
  }

  function push() {
    return api("/grocery", "PUT", { items: G.readList() }).then(function () { write(DIRTY, null); });
  }

  // Page load, already signed in. Unsent local edits win; otherwise the
  // server's copy replaces local, so a change made on another device shows up.
  function syncGrocery() {
    if (!G || !signedIn) return;
    api("/grocery").then(function (remote) {
      var local = G.readList();
      if (read(DIRTY) === "1" || remote.items === null) {
        if (remote.items === null && !local.length) return;
        return push();
      }
      if (JSON.stringify(remote.items) !== JSON.stringify(local)) replaceLocal(remote.items);
    }).catch(noop);
  }

  // Right after signing in: keep what's in this browser AND what's already on
  // the account (say, from a phone), so signing in never throws a list away.
  function mergeGroceryOnSignIn() {
    if (!G) return Promise.resolve();
    return api("/grocery").then(function (remote) {
      var merged = (remote.items || []).slice();
      var seen = {};
      merged.forEach(function (i) { seen[i.text.toLowerCase()] = true; });
      G.readList().forEach(function (i) {
        if (!seen[i.text.toLowerCase()]) merged.push(i);
      });
      replaceLocal(merged);
      return push();
    });
  }

  if (G) {
    window.addEventListener("dd:grocery-changed", function () {
      if (applying || !signedIn) return;
      write(DIRTY, "1");
      clearTimeout(pushTimer);
      pushTimer = setTimeout(function () { push().catch(noop); }, 800);
    });
  }

  // ------------------------------------------------------------ save button
  function initSaveButton() {
    var row = document.querySelector(".pin-save-row");
    var match = location.pathname.match(/^\/recipes\/([^/]+)\/?$/);
    if (!row || !match) return;
    var slug = decodeURIComponent(match[1]);
    var saved = false;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn save-btn";
    row.appendChild(btn);

    function paint() {
      btn.setAttribute("aria-pressed", saved ? "true" : "false");
      btn.textContent = saved ? "Saved — tap to remove" : "Save recipe";
    }
    paint();

    me().then(function (user) {
      if (!user) return;
      return api("/saved").then(function (data) {
        saved = data.slugs.indexOf(slug) !== -1;
        paint();
      });
    }).catch(noop);

    btn.addEventListener("click", function () {
      if (!signedIn) { location.href = "/account/"; return; }
      var want = !saved;
      api("/saved/" + encodeURIComponent(slug), want ? "PUT" : "DELETE").then(function () {
        saved = want;
        paint();
      }).catch(function () {
        btn.textContent = signedIn ? "Couldn't save — try again" : "Sign in to save";
      });
    });
  }

  // ----------------------------------------------------------- account page
  function initAccountPage() {
    var root = document.getElementById("account");
    if (!root) return;
    var statusEl = document.getElementById("account-status");
    function say(text) { statusEl.textContent = text || ""; }
    function view(name) {
      var panes = root.querySelectorAll("[data-view]");
      for (var i = 0; i < panes.length; i++) panes[i].hidden = panes[i].getAttribute("data-view") !== name;
    }

    var index = {};
    try {
      JSON.parse(document.getElementById("recipe-index").textContent).forEach(function (r) { index[r.slug] = r; });
    } catch (e) { /* titles fall back to the slug */ }

    function renderSaved(slugs) {
      var list = document.getElementById("saved-list");
      list.textContent = "";
      document.getElementById("saved-empty").hidden = slugs.length > 0;
      slugs.forEach(function (slug) {
        var li = document.createElement("li");
        var known = index[slug];
        var label;
        if (known) {
          label = document.createElement("a");
          label.href = known.url;
        } else {
          label = document.createElement("span");
        }
        label.textContent = known ? known.title : slug;
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-small";
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", "Remove " + label.textContent + " from saved recipes");
        remove.addEventListener("click", function () {
          api("/saved/" + encodeURIComponent(slug), "DELETE").then(function () { li.remove(); renderEmpty(); }).catch(function () {
            say("Couldn't remove that one — please try again.");
          });
        });
        li.appendChild(label);
        li.appendChild(remove);
        list.appendChild(li);
      });
    }
    function renderEmpty() {
      document.getElementById("saved-empty").hidden = document.getElementById("saved-list").children.length > 0;
    }

    function showAccount() {
      me().then(function (user) {
        if (!user) { view("signed-out"); return; }
        document.getElementById("account-email").textContent = user.email;
        view("signed-in");
        return api("/saved").then(function (data) { renderSaved(data.slugs); });
      }).catch(function () { say("Couldn't load your account — check your connection and reload."); });
    }

    // Arriving from the emailed link: the token is in the #fragment.
    var token = (location.hash.match(/token=([\w-]+)/) || [])[1];
    if (token) {
      history.replaceState(null, "", location.pathname);
      view("none");
      say("Signing you in…");
      api("/auth/verify", "POST", { token: token }).then(function () {
        signedIn = true;
        mePromise = null;
        write(SIGNED_IN, "1");
        return mergeGroceryOnSignIn().catch(noop);
      }).then(function () {
        say("");
        showAccount();
      }).catch(function (err) {
        say((err.body && err.body.message) || "Couldn't sign you in — check your connection and try again.");
        view("signed-out");
      });
    } else {
      showAccount();
    }

    var form = document.getElementById("login-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var button = form.querySelector("button[type=submit]");
      button.disabled = true;
      say("Sending…");
      var captcha = window.turnstile && form.querySelector(".cf-turnstile") ? window.turnstile.getResponse() || "" : "";
      api("/auth/request", "POST", { email: form.email.value, turnstileToken: captcha }).then(function () {
        say("");
        view("link-sent");
      }).catch(function (err) {
        say((err.body && err.body.message) || "Couldn't send that — please try again in a moment.");
        if (window.turnstile) window.turnstile.reset();
      }).then(function () { button.disabled = false; });
    });

    document.getElementById("logout-btn").addEventListener("click", function () {
      api("/auth/logout", "POST").catch(noop).then(function () {
        signedIn = false;
        mePromise = null;
        write(SIGNED_IN, null);
        write(DIRTY, null);
        say("You're signed out.");
        view("signed-out");
      });
    });

    document.getElementById("delete-btn").addEventListener("click", function () {
      if (!confirm("Delete your account? Your saved recipes and synced grocery list will be erased. This can't be undone.")) return;
      api("/me", "DELETE").then(function () {
        signedIn = false;
        mePromise = null;
        write(SIGNED_IN, null);
        write(DIRTY, null);
        say("Your account and everything saved in it has been deleted.");
        view("signed-out");
      }).catch(function () { say("Couldn't delete the account — please try again."); });
    });
  }

  syncGrocery();
  initSaveButton();
  initAccountPage();
})();
