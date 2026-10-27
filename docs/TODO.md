# To do

Left over from the October 2026 code / design / usability audit. Everything
else from that audit is done.

## Needs you (settings and accounts)

- [ ] **Turn on Turnstile for the submission form.** Right now the only spam
      check is the per-IP limit of 3 a minute, which still lets one address
      open about 4,000 pull requests a day. Create a Turnstile widget in the
      Cloudflare dashboard, put its site key in `turnstileSiteKey` in
      `_data/site.js`, and run `wrangler secret put TURNSTILE_SECRET_KEY` in
      `submission-worker/`. The code for both sides is already in place.
- [ ] **Auto-delete merged submission branches.** GitHub → repo Settings →
      General → tick "Automatically delete head branches". Each submission
      opens its own branch with a photo on it; without this they pile up.

## Content

- [ ] **Add `nutrition` (at least calories) and `keywords` to recipes** and
      emit them in the Recipe JSON-LD in `_includes/layouts/recipe.njk`.
      Google uses them for richer recipe results. Only with real values —
      and never add `aggregateRating` without real reviews.

## Features

- [ ] **Servings scaler on recipe pages.** Needs a parser for amounts like
      `1/2`, `1 1/2`, `¼` and ranges, and a rule for units that shouldn't
      scale (pinch, to taste). Worth an `npm test` case per amount format.

## Small polish

- [ ] "Save to Pinterest" link is 23px tall — passes WCAG 2.5.8 on spacing,
      but a little more vertical padding would make it easier to tap.
- [ ] The stat strip shows a bare "m" when a recipe has no prep or cook time
      (e.g. a freshly merged submission before it's filled in).

## Not yet checked

- [ ] A pass with a real screen reader (VoiceOver on iPhone, NVDA on Windows)
      over a recipe page, the grocery list and the submit form.
- [ ] 200% browser zoom on the same three pages.
