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

## Considered and deliberately not done

- **Minifying `style.css`.** Measured: 14.9 KB → 11 KB raw, but 3.6 KB → 2.7 KB
  after the gzip that GitHub Pages already applies. Under a kilobyte on one
  cached file, in exchange for turning a passthrough copy into a build step.
  Not worth it.
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
