// Two pointer flourishes: a trail of small food marks that follows the pointer
// (or a dragging finger), and a sprinkle burst when the "Add ingredients to
// Grocery List" button is pressed.
//
// The site holds 100/100 on Lighthouse, so both are built to cost as close to
// nothing as a moving effect can:
//
//   - No requestAnimationFrame loop. Every mark and every sprinkle runs as a
//     compositor animation, so once this file has placed a particle the main
//     thread does nothing for the rest of its life. The only rAF here is a
//     one-shot, used to batch spawns into a frame.
//   - No allocation once running. Both effects are fixed pools of DOM nodes
//     *and* of Animation objects, built once and reused. Spawning a trail
//     mark is one style write and a rewind; it never creates anything.
//   - Nothing exists until it's needed. Neither pool is built until the first
//     pointer move and the first press, so a visitor who never moves a mouse
//     pays for this file and not one node more.
//   - Trail marks are spawned by distance travelled, not per event, so a
//     1000 Hz gaming mouse costs exactly what a 125 Hz one does.
//   - Everything lives in one fixed, pointer-events:none, CSS-contained layer,
//     so a particle can never reflow the page or swallow a click.
//
// Reduced motion turns both off — checked here as well as in the stylesheet,
// so with the preference on, no pool is ever built.
(function () {
  // Element.animate is how both effects run. Without it (very old browsers)
  // the site is simply the site: nothing is built and nothing is bound.
  if (!Element.prototype.animate) return;

  var TRAIL_POOL = 16; // marks alive at once before the oldest is reused
  var TRAIL_GAP = 46; // px of pointer travel between marks
  var BURST_COUNT = 14;
  var BURST_SELECTOR = ".grocery-add-btn";

  // Chosen to stay visible on both grounds: every one of these clears 2:1 on
  // the cream page and 5:1 on the dark one. Fixed rather than themed, because
  // sprinkles that turn monochrome in dark mode stop reading as sprinkles.
  var SPRINKLES = ["#d9785c", "#e3a857", "#7f9e7a", "#c2738c", "#6f8fa8"];

  // Whisk, cherries, steam. Stroked in currentColor, which the layer inherits
  // from --accent, so they follow the theme without a second set of assets.
  // Kept to a handful of paths each: at 18px, detail is just noise.
  var SHAPES = [
    // Whisk. The three wires have to stay visibly separate at the tip — close
    // them into a loop and it reads as a wine glass, which is what the first
    // draft of this did.
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round">' +
      '<path d="M12 21.5V14"/><path d="M12 14c-4.6-1.7-5.6-8.6-2-11.8"/>' +
      '<path d="M12 14c4.6-1.7 5.6-8.6 2-11.8"/><path d="M12 14V2.4"/></svg>',
    // Cherries. Fruit large, stems short and gently curved — long straight
    // stems from one point just draw a lambda.
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round">' +
      '<path d="M13.4 5.2C11.4 8 9.3 10.8 8.2 13.4"/>' +
      '<path d="M13.4 5.2c1.3 2.9 2.2 5.8 2.6 8.4"/>' +
      '<path d="M13.4 5.2c1.8-2.2 4.2-2.1 5.4-1.1-.5 1.8-2.6 3-5.4 1.1z" fill="currentColor" stroke="none"/>' +
      '<circle cx="7" cy="17.3" r="3.7" fill="currentColor" stroke="none"/>' +
      '<circle cx="16.6" cy="17.5" r="3.4" fill="currentColor" stroke="none"/></svg>',
    // Steam: two upright waves of unequal height. Needs three bends and real
    // amplitude — one shallow curve just draws a bracket, which is what the
    // first two attempts at this did.
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round">' +
      '<path d="M8.4 21.8c0-2.9 4-3.3 4-6.2s-4-3.3-4-6.2s4-3.3 4-6.2"/>' +
      '<path d="M17 21.8c0-2.2 2.8-2.5 2.8-4.7s-2.8-2.5-2.8-4.7"/></svg>',
  ];

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var layer = null;
  var trail = null;
  var trailAt = 0;
  var burstBox = null;
  var burstAnims = [];

  var lastX = 0;
  var lastY = 0;
  var tracking = false;
  var queuedX = 0;
  var queuedY = 0;
  var frameQueued = false;
  var lastScrollAt = 0;
  var touchX = 0;
  var touchY = 0;

  function getLayer() {
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "dd-fx";
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    return layer;
  }

  function buildTrail() {
    if (trail) return;
    var parent = getLayer();
    trail = [];
    for (var i = 0; i < TRAIL_POOL; i++) {
      // Two nodes per mark on purpose: the outer one carries the position this
      // file writes, the inner one carries the keyframes. One element can't do
      // both, because an animated transform would overwrite an inline one.
      var outer = document.createElement("span");
      outer.className = "dd-mark";
      var art = document.createElement("span");
      art.className = "dd-mark-art";
      // Pool size 16 over 3 shapes: 16 isn't a multiple of 3, so the sequence
      // shifts by one every time the ring wraps instead of repeating.
      art.innerHTML = SHAPES[i % SHAPES.length];
      outer.appendChild(art);
      parent.appendChild(outer);

      // Each mark gets its own animation object, built once, with its drift
      // and spin already baked into concrete values.
      //
      // This started life as a CSS keyframe reading var(--dd-dx), set per
      // spawn. That looked cheaper and measured far worse: Chromium won't put
      // a transform animation on the compositor if its keyframes contain
      // var(), so all sixteen live marks were being restyled on the main
      // thread every frame — 1.35 ms of a 16.7 ms budget. Concrete values
      // here composite properly and cost ~0.03 ms/frame. Sixteen different
      // baked drifts give the same variety the random values did.
      var drift = (Math.random() * 16 - 8).toFixed(1);
      var spin = (Math.random() * 50 - 25).toFixed(0);
      var anim = art.animate(
        [
          { opacity: 0.9, transform: "translate3d(0,0,0) scale(0.5) rotate(0deg)" },
          {
            opacity: 0,
            transform:
              "translate3d(" + drift + "px,18px,0) scale(1.05) rotate(" + spin + "deg)",
          },
        ],
        { duration: 900, easing: "cubic-bezier(0.22,0.61,0.36,1)" }
      );
      anim.cancel();

      trail.push({ outer: outer, anim: anim });
    }
  }

  function spawn() {
    frameQueued = false;
    buildTrail();

    var mark = trail[trailAt];
    trailAt = (trailAt + 1) % TRAIL_POOL;

    mark.outer.style.transform =
      "translate3d(" + queuedX + "px," + queuedY + "px,0)";

    // Rewinding and playing restarts a mark whether it had finished or is
    // still in flight, with none of the forced reflow a CSS restart needs.
    mark.anim.currentTime = 0;
    mark.anim.play();
  }

  function track(x, y) {
    if (reduceMotion.matches) return;

    if (!tracking) {
      lastX = x;
      lastY = y;
      tracking = true;
      return;
    }

    var dx = x - lastX;
    var dy = y - lastY;
    // Compared squared — no Math.sqrt on a path that runs per pointer event.
    if (dx * dx + dy * dy < TRAIL_GAP * TRAIL_GAP) return;

    lastX = x;
    lastY = y;
    queuedX = x;
    queuedY = y;

    // Everything that touches the DOM happens in the frame callback, never in
    // the event, so a burst of coalesced pointer events can't spawn twice in
    // one frame or interleave writes with the browser's own style work.
    if (!frameQueued) {
      frameQueued = true;
      requestAnimationFrame(spawn);
    }
  }

  function onPointerMove(e) {
    // Touch is handled below, not here. A finger does emit a couple of
    // pointermove events before the browser claims the gesture, and letting
    // those through would put one mark at the top of every scroll — past the
    // guards in onTouchMove, which is the only place that can see the gesture.
    if (e.pointerType === "touch") return;
    track(e.clientX, e.clientY);
  }

  // Touch needs its own source. The moment the browser decides a finger
  // gesture belongs to it, it sends pointercancel and the pointer stream stops
  // — measured here, a swipe produces two pointermove events and then nothing,
  // while touchmove keeps firing for the whole drag.
  function onTouchStart(e) {
    var t = e.touches[0];
    if (t) {
      touchX = t.clientX;
      touchY = t.clientY;
    }
  }

  function onTouchMove(e) {
    // ...but not while the page is scrolling. There the trail would be drawing
    // onto content sliding out from under it, and a scroll is the one moment
    // on a phone that can least afford the extra work.
    //
    // Two guards, because one isn't enough. The timestamp catches momentum
    // after the finger lifts, but it can't catch the start of a scroll — no
    // scroll event has fired yet, so a mark escapes on the first move of every
    // swipe. Judging the gesture on its dominant axis decides that from the
    // very first event instead. A sideways or diagonal drag still trails.
    if (Date.now() - lastScrollAt < 180) return;
    var t = e.touches[0];
    if (!t) return;
    var dx = t.clientX - touchX;
    var dy = t.clientY - touchY;
    if (Math.abs(dy) > Math.abs(dx)) return;
    track(t.clientX, t.clientY);
  }

  function buildBurst() {
    if (burstBox) return;
    burstBox = document.createElement("span");
    burstBox.className = "dd-burst";
    for (var i = 0; i < BURST_COUNT; i++) {
      var p = document.createElement("span");
      p.className = "dd-sprinkle";
      // Directions are settled now and never recomputed. That's what makes a
      // burst two style writes at press time instead of fourteen.
      var angle = (i / BURST_COUNT) * Math.PI * 2 + Math.random() * 0.45;
      var reach = 38 + Math.random() * 34;
      var dx = (Math.cos(angle) * reach).toFixed(1);
      // Biased downward so the burst falls away instead of hanging in the air.
      var dy = (Math.sin(angle) * reach + 26).toFixed(1);
      var spin = (Math.random() * 540 - 270).toFixed(0);
      p.style.background = SPRINKLES[i % SPRINKLES.length];
      burstBox.appendChild(p);

      // Concrete values for the same reason the trail uses them: keyframes
      // carrying var() are animated on the main thread, and a hitch is worst
      // exactly here, in the frame where someone has just pressed a button.
      var anim = p.animate(
        [
          { opacity: 1, transform: "translate3d(0,0,0) rotate(0deg) scale(1)" },
          { opacity: 1, offset: 0.55 },
          {
            opacity: 0,
            transform:
              "translate3d(" + dx + "px," + dy + "px,0) rotate(" + spin + "deg) scale(0.4)",
          },
        ],
        { duration: 700, easing: "cubic-bezier(0.15,0.7,0.35,1)" }
      );
      anim.cancel();
      burstAnims.push(anim);
    }
    getLayer().appendChild(burstBox);
  }

  function onPress(e) {
    if (reduceMotion.matches) return;

    var x = e.clientX;
    var y = e.clientY;
    // Enter or Space on the button arrives as a click at (0, 0), which would
    // fire the burst in the corner. Measuring the button is a layout read,
    // which is exactly why it's confined to that path.
    if (!e.detail) {
      var box = e.currentTarget.getBoundingClientRect();
      x = box.left + box.width / 2;
      y = box.top + box.height / 2;
    }

    buildBurst();
    burstBox.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    // Rewind-and-play, so pressing twice quickly replays the burst instead of
    // being ignored mid-flight.
    for (var i = 0; i < burstAnims.length; i++) {
      burstAnims[i].currentTime = 0;
      burstAnims[i].play();
    }
  }

  // Mouse and pen come through here; touch is handled above.
  document.addEventListener("pointermove", onPointerMove, { passive: true });

  if ("ontouchstart" in window) {
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    // Writes one number, at most once a frame, and saves the touch handler
    // from ever having to read scroll position (which can force a layout).
    window.addEventListener(
      "scroll",
      function () {
        lastScrollAt = Date.now();
      },
      { passive: true }
    );
  }

  // Bound directly rather than delegated: the button exists in the markup or
  // it doesn't, and on every page without one this leaves no listener at all.
  var buttons = document.querySelectorAll(BURST_SELECTOR);
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", onPress);
  }
})();
