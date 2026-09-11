# Performance notes

What's been done to keep the site fast, why, and the few things deliberately
left alone. Numbers here were measured on a local build with Chrome; the
absolute figures will differ on a real connection, but the differences between
before and after are the point.

## The fonts are self-hosted

The biggest single cost used to be the typefaces. The page asked
`fonts.googleapis.com` for a stylesheet, waited for it (DNS, TLS, response),
and only then learned which font files to fetch from a *second* host,
`fonts.gstatic.com`. Nothing could paint text until that finished.

Now the two families live in `fonts/` as `.woff2` files and their `@font-face`
rules sit at the top of `style.css`, so there's no extra stylesheet and no
third-party connection at all. Two preload hints in
`_includes/partials/fonts.njk` start the faces used above the fold downloading
alongside the CSS.

Measured first contentful paint, before → after:

| Page | Before | After |
|---|---|---|
| Homepage | 632 ms | 72 ms |
| A recipe | 524 ms | 80 ms |
| Grocery list | 508 ms | 56 ms |

A visitor still downloads the same 2–3 font files they always did; they just
arrive without two round trips in front of them.

**To change a typeface later:** pick it on fonts.google.com, copy the CSS URL
it gives you, and regenerate the kit rather than hand-editing anything:

1. Fetch the Google stylesheet with a modern browser user-agent (that's what
   makes Google return `woff2` rather than `ttf`).
2. For each face you want, pull the `latin` subset URL out of it — the block
   whose `unicode-range` starts `U+0000-00FF`.
3. Save those files into `fonts/` and replace the `@font-face` block at the top
   of `style.css` to match, keeping `font-display: swap`.
4. Update the two `<link rel="preload">` tags in
   `_includes/partials/fonts.njk` to the new filenames — a preload pointing at
   a file that no longer exists is a wasted download and a console warning.

Latin subset only, which already covers the accents recipes use (sauté, crème,
jalapeño). Add `latin-ext` too if a recipe ever needs Central European letters.

## Pinterest's script only loads where it's used

`pinit.js` exists to turn the Pin button on a recipe page into a real save
widget. It was being loaded from the footer, which every page includes — so the
homepage, About, Contact, Privacy and the grocery list each opened connections
to two Pinterest hosts for a button that wasn't on the page. It now loads in
`_includes/layouts/recipe.njk` only.

## The logo is served at the size it's shown

`images/logo-mark.png` is 240×240 and 18 KB, displayed at 34–40 px. Every page
paid for it. `images/logo-mark-96.png` (1.3 KB) is what the header and footer
use now — 96 px covers a 2× display with room to spare. The original is still
in the repo; the CMS login screen uses it, where it's shown larger.

## Images

Already handled by `@11ty/eleventy-img` in `.eleventy.js`: every `<img>` becomes
a responsive AVIF/WebP/JPEG `<picture>` at four widths, chosen from the tag's
own `sizes` attribute. Recipe heroes and the homepage's lead card are marked
`loading="eager"` with `fetchpriority="high"`; everything below the fold is
lazy. No change needed here.

## The pointer effects are compositor-only

`sprinkles.js` adds two flourishes: a trail of small food marks (whisk,
cherries, steam) that follows the pointer or a dragging finger, and a sprinkle
burst from the "Add ingredients to Grocery List" button. Both are built so the
main thread does as close to nothing as a moving effect allows.

- **No animation loop.** There is no `requestAnimationFrame` loop at all. Every
  particle is an `Element.animate()` animation, so once a particle is placed
  the compositor owns it. The single rAF in the file is a one-shot that batches
  spawns into a frame. Measured: **zero rAF callbacks across a full idle
  second** after the trail has played out.
- **No allocation while running.** The trail is a fixed pool of 16 nodes and 16
  `Animation` objects, built once and reused round-robin; the burst is 14 of
  each. Spawning a mark is one style write plus a rewind.
- **Nothing exists until used.** Neither pool is built until the first pointer
  move and the first press. A visitor who never moves a mouse gets the file and
  no DOM at all.
- **Spawn by distance, not by event.** A mark appears every 46px of travel, so a
  1000 Hz mouse costs what a 125 Hz one does. Measured: 300 pointer events with
  no real travel spawn nothing.
- **No layout reads on the hot path.** `getBoundingClientRect` is called in
  exactly one place — placing the burst when the button is triggered by
  keyboard, where the click arrives at (0, 0) and there is nothing else to go
  on. Measured: zero layout reads during a sweep.

### What that cost, measured

Chrome DevTools Protocol `Performance.getMetrics`, on a recipe page, comparing
the same page and the same hover work with `sprinkles.js` loaded against it
blocked. 480 frames of continuous full-viewport mouse sweeping — far busier
than real use:

| | script | style recalc | total |
|---|---|---|---|
| Trail running | 0.06 ms/frame | 0.74 ms/frame | **0.79 ms/frame** |

That is 4.7% of a 16.7 ms frame, in a synthetic worst case, and nothing at all
when the pointer is still. Three repeat runs landed within 0.05 ms of each
other.

**The one real trap here.** The first version put the drift and spin in CSS
`@keyframes` reading `var(--dd-dx)`, set per spawn. It looks cheaper — no JS
per particle — and measured nearly twice as expensive, 1.35 ms/frame. Chromium
will not run a transform animation on the compositor if its keyframes contain
`var()`, so all sixteen live marks were being restyled on the main thread every
frame. Baking concrete values into per-node `Element.animate()` calls fixed it.
If these effects are ever edited, keep `var()` out of animated transforms.

Both effects are off entirely under `prefers-reduced-motion: reduce` — checked
in the script, so no pool is built, and again in the stylesheet. The site's
existing blanket rule only disables *transitions*, not animations, which is why
the second guard is there. The layer is `aria-hidden`, `pointer-events: none`
and `contain: layout paint style`, so it can never intercept a click or
invalidate paint on the page beneath it. It is hidden in print.

## The two front-end scripts are minified

`grocery-list.js` and `sprinkles.js` are passthrough copies, so nothing was
stripping their comments — and both are commented heavily. An `eleventy.after`
hook in `.eleventy.js` now runs terser over them in the output directory:

| | before | after |
|---|---|---|
| `sprinkles.js` | 3.5 KB gzipped | 1.3 KB gzipped |
| `grocery-list.js` | 721 B gzipped | 302 B gzipped |

This is the same trade that was declined for `style.css` below, and it comes
out the other way for two reasons: the saving is roughly triple, and terser is
already in the dependency tree for the HTML minifier, so it costs no new
install. The sources keep their comments either way.

## Considered and deliberately not done

- **Minifying `style.css`.** Measured: 14.9 KB → 11 KB raw, but 3.6 KB → 2.7 KB
  after the gzip that GitHub Pages already applies. Under a kilobyte on one
  cached file, in exchange for turning a passthrough copy into a build step.
  Not worth it. (The two JS files *are* minified — see above for why that one
  goes the other way.)
- **Trimming unused font weights from the request.** No benefit: browsers only
  download the faces a page actually renders, so weights listed but unused cost
  nothing at load time. (This was worth checking — it's commonly recommended.)
- **A DocumentFragment in the grocery list's render loop.** Correct in
  principle, unmeasurable for a shopping list of a few dozen items.
- **Removing Google Analytics.** It's three of the remaining third-party
  requests, all `async`, and it's there because you want the numbers. Worth
  knowing it's the last third-party weight on the site, if that ever changes.

## Build

`npm run build` takes about 3 seconds with a warm image cache in `.cache/`
(delete it and the first build takes minutes while every photo is re-encoded —
that's normal, and CI caches it). The HTML minifier's dynamic `import()` is
resolved once and reused rather than awaited inside all ~50 page transforms.

## Audit results

Measured with Lighthouse (desktop preset) and axe-core 4.10 against a local
build, after the changes above.

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Homepage | 100 | 100 | 100 | 100 |
| A recipe | 100 | 100 | 100 | 100 |
| Submit a Recipe | 100 | 100 | 100 | 100 |
| 404 | 100 | 100 | 100 | 100 |

Mobile preset scores 99 on performance; the single point is "reduce unused
CSS", which means one stylesheet serves every page. Splitting it per page would
save a few hundred bytes after gzip and cost a build step — not worth it.

axe-core reports **no violations** on any page, at WCAG 2.1 A/AA plus its
best-practice rules, including the grocery list with items in it and the
submission form in its error state.

### What that took

- **Contrast.** `--ink-faint` was `#a49c92` — 2.66:1 on the page background,
  against the 4.5:1 AA needs for text that size. It failed on card meta lines
  ("35 min · 4 servings"), the footer line, and italic text. Now `#7a7267`,
  at 4.67:1.
- **Dark mode.** The palette added in `style.css` was checked the same way.
  Against the `#14120f` ground: `--ink` 15.8:1, `--ink-soft` 8.2:1,
  `--ink-faint` 6.0:1, `--accent` 6.1:1 — every tier clears AA. The brick
  `--accent` could not simply be reused; `#8a3324` sits at 1.3:1 on that ground
  and is invisible, so dark mode lifts it to a `#d9785c` terracotta. Filled
  accent and ink blocks (the primary nav pill, the submit button) had white
  lettering hard-coded; that is now `--on-accent` / `--on-ink`, because both
  fills invert in dark mode.
- **Landmarks.** Page content sat in plain `<div>`s, so a screen reader had no
  "main" region to skip to and reported every block as outside a landmark.
  `page.njk`, `recipe.njk` and `tools/grocery-list.html` now wrap their content
  in `<main>`.
- **Two navs, no names.** The category nav and the footer nav were both bare
  `<nav>` elements; each now carries an `aria-label` so they can be told apart.

### Structured data and social

Recipe JSON-LD was missing `author` and `datePublished`, both of which Google
lists as recommended for recipe rich results and flags in Search Console. Both
are now emitted. Recipes also carry `twitter:card`, `og:url` and `og:site_name`,
so a shared link renders as a photo card rather than a bare URL; other pages
carry the `og:`/`twitter:` basics too.

There was no 404 page, so a mistyped or retired link landed on GitHub's grey
default with no route back to the site. `404.njk` builds one.
