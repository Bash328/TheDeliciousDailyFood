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
- [ ] **Deploy the submission worker after the optional-photo / cuisine change.**
      It deploys by hand (not through Git). From `submission-worker/` run
      `npx.cmd wrangler deploy --config ./wrangler.toml` (`npx.cmd`, because PowerShell
      on this machine blocks plain `npx`). The `--config` matters:
      the repo root has another `wrangler.jsonc` (the admin app), and without it
      Wrangler picks that one up and deploys the wrong worker. Already signed in
      on this machine; secrets survive a redeploy.

## Content

- [ ] **Add `nutrition` (at least calories) and `keywords` to recipes** and
      emit them in the Recipe JSON-LD in `_includes/layouts/recipe.njk`.
      Google uses them for richer recipe results. Only with real values —
      and never add `aggregateRating` without real reviews.

## Features

- [ ] **Servings scaler on recipe pages.** Needs a parser for amounts like
      `1/2`, `1 1/2`, `¼` and ranges, and a rule for units that shouldn't
      scale (pinch, to taste). Worth an `npm test` case per amount format.

- [ ] **My Kitchen follow-ups** (the page itself is live at `/my-kitchen/`;
      ingredient list, matcher and swap table in `lib/kitchen.js`):
      - After adding recipes, run `node scripts/kitchen-audit.js`. Lines that
        match nothing always show as "missing", so add a word for them.
      - A line that both lists and offers a choice ("sour cream and parsley or
        dill") is read as "any one of these". Good enough so far.
      - Possible later: a "use up this ingredient" mode.
- [ ] **Quick picks (done) follow-ups:** "30 minutes or less" does not count
      chilling or rising. If that misleads, add an optional "active time" field.

- [ ] **Ratings / "I made this".** Signed-in users only (reuse the email
      sign-in in `api-worker/`): a one-tap "I made this" plus an optional 1-5
      star rating per recipe, stored in the worker's database. Show it on
      recipe pages and cards only once a recipe has about 3 ratings; add a
      "Most made" quick pick; add `aggregateRating` to the Recipe JSON-LD only
      when real ratings exist. Counts load from the worker (cache them) so the
      static pages stay fast. No photo uploads or comment threads (moderation).

## Small polish

- [ ] "Save to Pinterest" link is 23px tall — passes WCAG 2.5.8 on spacing,
      but a little more vertical padding would make it easier to tap.
- [ ] The admin quick-post page (`admin/quick/index.html`) has a typed-in list
      of cuisine suggestions. Add to it when a new cuisine gets its own page
      (two or more recipes), or the new name just will not be suggested.
- [ ] The stat strip shows a bare "m" when a recipe has no prep or cook time
      (e.g. a freshly merged submission before it's filled in).

## Not yet checked

- [ ] A pass with a real screen reader (VoiceOver on iPhone, NVDA on Windows)
      over a recipe page, the grocery list and the submit form.
- [ ] 200% browser zoom on the same three pages.
