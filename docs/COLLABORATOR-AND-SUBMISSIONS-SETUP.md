# Adding a collaborator login + a public submission form

This adds two things on top of the existing GitHub-login CMS at `/admin/`:

1. **`/admin/collaborator/`** — a second content-manager login for one other
   person, using an email + password instead of a GitHub account.
2. **`/submit-recipe/`** — a public page anyone can use to send in a recipe.
   It never publishes anything directly; it opens a pull request on the repo
   with a draft recipe file, which you review and merge like any other PR.

Both are already wired into the code in this repo. What's left is account
setup on Netlify's and Cloudflare's side, and pasting a couple of values into
`_data/site.js`. None of it moves the site — it stays on GitHub Pages exactly
as it is now.

The two halves are independent. You can do Part 1 without Part 2, or the other
way round.

---

## Part 1 — Collaborator login (Netlify Identity + Git Gateway)

Netlify Identity is a free user-login service. Git Gateway is what lets Decap
CMS use that login to read and write your GitHub repo, instead of asking the
person for a GitHub account of their own. You're not moving the site to
Netlify — you're using Netlify for this one login service and nothing else.

1. **Create a free Netlify account** at netlify.com if you don't have one.
   Signing in with GitHub is fine.
2. **Add a new site** → "Import an existing project" → pick
   `Bash328/TheDeliciousDailyFood`. Netlify will offer to build and deploy it;
   that's fine, ignore the `*.netlify.app` URL it gives you, you won't use it.
   (If you'd rather Netlify never built the repo at all, "Deploy manually" with
   an empty folder also works — Identity and Git Gateway don't care whether
   Netlify's own deploy succeeded.)
3. In that Netlify site's dashboard: **Site configuration → Identity → Enable
   Identity**.
4. Still under Identity: **Registration → set to "Invite only"**, so strangers
   can't sign themselves up.
5. **Identity → Services → Git Gateway → Enable Git Gateway.** When it asks for
   a GitHub personal access token, generate one at github.com → Settings →
   Developer settings → Personal access tokens → Fine-grained tokens, scoped to
   just this repository, with **Contents: Read and write**. Paste it in.
6. **Site configuration → General → Site details**, set the site's **Site URL**
   to `https://thedeliciousdaily.com` — your real domain, not the
   `*.netlify.app` one. This is what makes invite and password-reset emails
   link to your real site instead of the throwaway Netlify one.
7. **Identity → Invite users**, enter your collaborator's email address. They
   get an email with a link back to `thedeliciousdaily.com`; the homepage has a
   small script (`_includes/partials/identity-redirect.njk`) that spots the
   invite token in that link and forwards them straight to
   `/admin/collaborator/` to set their password.
8. From then on they log in at
   `https://thedeliciousdaily.com/admin/collaborator/` with that email and
   their password. They see the same Recipes form you do, and their edits
   become ordinary commits on the same repo — nothing about the build changes.

**To remove their access later:** Netlify → Identity → find them → Delete user.
That's it, no code changes needed.

**If you add or change a field in the CMS**, edit `admin/config.yml` *and*
`admin/collaborator/config.yml` — each login needs its own config file because
each names a different backend, but the `collections:` block should stay
identical between them. The build prints a warning if the two ever drift apart.

---

## Part 2 — Public submission form → pull request worker

This is a second, separate Cloudflare Worker from the OAuth one in
`oauth-worker/` — different job, kept apart so a problem in one can't reach the
other.

Until it's set up, `/submit-recipe/` builds as a short "submissions aren't open
yet" note and nothing on the site links to it, so there's no half-working form
sitting on the live site in the meantime.

1. **Create a GitHub token for the worker.** Same place as step 5 above
   (fine-grained personal access token, scoped to this one repo), but this one
   needs **Contents: Read and write** *and* **Pull requests: Read and write**.
   It can be the same token Git Gateway uses or a separate one — separate is a
   little safer, since you can revoke one without touching the other.

2. **Deploy the worker.** From the `submission-worker/` folder:

   ```
   npm install -g wrangler   # if you don't have it already
   wrangler login
   cd submission-worker
   wrangler deploy
   wrangler secret put GITHUB_TOKEN
   ```

   Paste the token from step 1 when prompted. Wrangler prints the worker's URL,
   something like
   `https://delicious-daily-submissions.<your-subdomain>.workers.dev`.

3. **Check `submission-worker/wrangler.toml`** — `GITHUB_OWNER`, `GITHUB_REPO`,
   `GITHUB_BRANCH`, and `ALLOWED_ORIGIN` are already filled in for this repo and
   domain. Only change them if one of those ever changes.

4. **Turn the form on.** In `_data/site.js`, set `submitEndpoint` to the
   worker's URL with `/submit` on the end:

   ```js
   submitEndpoint: "https://delicious-daily-submissions.YOUR-SUBDOMAIN.workers.dev/submit",
   ```

   Commit that. Once the site rebuilds, `/submit-recipe/` shows the real form
   and a "Submit a Recipe" link appears in the footer and in sitemap.xml.

5. **(Recommended) Turn on spam protection.** [Cloudflare
   Turnstile](https://developers.cloudflare.com/turnstile/) is free, needs no
   account from visitors, and is usually invisible to them:

   - Cloudflare dashboard → Turnstile → Add site → gives you a **Site Key** and
     a **Secret Key**.
   - Put the Site Key in `_data/site.js` as `turnstileSiteKey`.
   - `wrangler secret put TURNSTILE_SECRET_KEY` on the submission worker, and
     paste the Secret Key.

   Both halves matter: the site key alone only draws the widget, and the secret
   alone rejects everything. If you skip this entirely (leave `turnstileSiteKey`
   empty and don't set the secret), the widget isn't loaded and the worker skips
   the check — submissions still work, just with only the honeypot field and the
   worker's own limits standing between you and spam.

6. **Test it.** Go to `/submit-recipe/`, fill in a test recipe, submit. You
   should see "it's been sent in for review", and a pull request titled "Recipe
   submission: …" should appear on the repo within a few seconds, with the
   submitter's pasted text, photo and contact details in the description.

### Reviewing a submission

1. Open the PR on GitHub and read the description — category, short
   description, submitter contact (if they gave any), their photo, and their
   raw recipe text.
2. Merge it (or edit the file on that branch first, if you'd rather clean it up
   before merging — normal GitHub PR editing). Their photo is already on the
   branch and already set as the recipe's photo.
3. Once merged, open `/admin/` and find the new recipe. It's there with **Keep
   hidden from the live site** switched on, so it isn't on the homepage.
4. Paste the submitter's raw text from the PR description into the **Quick
   Paste** box on the Recipe content field, click **Parse & Fill**, adjust as
   usual, swap the photo if you'd rather use your own, switch off **Keep hidden
   from the live site**, and Publish.

If you decide not to use a submission, close the PR without merging — nothing
was ever written to `main`.

### What gets accepted

A submission has to be a usable recipe with a photo, or it isn't sent. The
rules live in one file, `submission-worker/validate.js`, and are applied twice:
the form checks them before sending (so a person is told what's missing while
they're still looking at the form), and the worker checks them again on arrival
(because anything can POST to the endpoint, form or not). The build inlines
that same file into the page, so the two can't drift apart.

What it requires:

| | |
|---|---|
| Photo | **Required.** A real JPEG, PNG or WebP, under 4 MB. |
| Title | 3–120 characters, no links. |
| Category | One of the site's five. |
| Description | At least 20 characters and 4 words, no links, 280 max. |
| Recipe | At least 120 characters, and no more than 6000. |
| — ingredients | At least 3 lines carrying an amount ("2 cups flour", "1 tsp salt"). |
| — method | At least 2 steps that open with an instruction ("Preheat…", "Whisk…"). Numbered lists and plain paragraphs both count. |
| Links | At most 2 in the recipe text, none in the title or description. |

Each rule has a message that says what to do about it, and the form puts the
cursor on the field that needs fixing.

**To change any of this**, edit `submission-worker/validate.js` — then rebuild
the site *and* redeploy the worker (`wrangler deploy`), since both carry a copy.
If you find the ingredient-line rule too strict — a recipe written as one flowing
paragraph rather than a list will be turned away — `minIngredientLines` at the
top of that file is the number to lower.

### Photos

One photo of the finished dish is required with every submission.

- The visitor's browser shrinks it before sending — longest edge 1600px (the
  widest size the site's image pipeline builds), re-encoded as JPEG. A 9 MB
  phone photo arrives as a few hundred KB, and re-encoding drops the EXIF
  block, so nobody submits the GPS coordinates of their kitchen by accident.
- The worker checks the file's actual leading bytes, not what the form claims
  it is, and accepts only JPEG, PNG and WebP. An SVG is refused — it can carry
  script — as is anything over 4 MB. A submission with no usable photo is
  turned away outright.
- An accepted photo is committed to `images/submitted-<slug>-<id>.jpg` on the
  submission branch and set as the recipe's `image:`, so merging the PR brings
  the photo along already attached. The PR description shows it inline.
- To take the recipe but not the photo: delete the image file from the branch
  and clear the `image:` line before merging.
- iPhone HEIC files can't be decoded by most browsers. The form says so and
  asks for a JPEG rather than failing silently.

### What the worker never does

- The recipe file it commits contains only the title, slug, date, category,
  description, photo path and `draft: true`. The submitter's free text goes in
  the PR description, never into the site's files, so nothing they typed can
  reach the live site without you pasting it in yourself.
- A submission whose title matches an existing recipe's slug gets a suffix on
  its filename, so it can't overwrite or collide with a published recipe.
- A filled-in honeypot field is answered with a cheerful "ok" and then dropped.

---

## Testing checklist

- [ ] Collaborator can log in at `/admin/collaborator/` with email and password
      and sees the Recipes collection.
- [ ] A recipe published by the collaborator appears on the live site like any
      other.
- [ ] Submitting the form at `/submit-recipe/` produces a PR with the expected
      content.
- [ ] A recipe merged with the draft box checked does **not** appear on the
      homepage until the box is unchecked and republished.
- [ ] (If Turnstile is enabled) submitting without completing it is rejected.

## A note on the admin restyle

`admin/theme.js` (shared by `/admin/` and `/admin/collaborator/`) gives the CMS
the site's font, colors and logo. The `logo_url` / `site_url` / `display_url`
keys in each `config.yml` are official Decap options and will keep working
across upgrades. The rest of `theme.js` targets Decap's rendered class names,
which aren't a documented, stable API — it matches the Decap 3.x build in place
now, but a future Decap upgrade could rename them and make some color overrides
quietly stop applying. Nothing breaks if that happens; the admin just looks more
like stock Decap again. If it does, inspect the admin in your browser's dev
tools and update the selectors in `theme.js` — or, for a genuinely custom look,
a bespoke admin panel built against the GitHub API is the real path, and a much
bigger project.

---

## Security notes for the two workers

Both workers were reviewed against the usual OAuth and public-endpoint
expectations. Nothing here changes how you use them, but **both need
redeploying (`wrangler deploy` in their folder) for these to take effect** —
the versions currently running on Cloudflare still have the old code.

### The OAuth relay (`oauth-worker/`)

- **It asks for less access than it used to.** The scope was `repo,user`, which
  hands the signed-in account's token rights over *every* repository it can
  reach, private ones included. This repo is public and Decap only needs its
  contents, so the scope is now `public_repo`. GitHub will ask you to authorize
  the app once more after you redeploy — that prompt is expected.
- **The state parameter is now actually checked.** It was generated and then
  never verified, which is the decorative version of OAuth's CSRF protection.
  It's now stored in an `HttpOnly; Secure; SameSite=Lax` cookie at the start of
  the flow and compared when GitHub calls back; a mismatch is refused.
- **The token is only handed to this site.** The callback page used to post the
  access token to whichever window answered its handshake. It now checks the
  origin against `ALLOWED_ORIGIN` and posts only there. Keep that var in step
  with the real domain if it ever changes.

### The submission worker (`submission-worker/`)

- **Per-IP rate limit: 3 submissions a minute.** Turnstile only stops bots that
  come through a browser, and only once you've configured it — this sits
  underneath, so nobody can loop on the endpoint opening pull requests either
  way. It's the `[[unsafe.bindings]]` block in `wrangler.toml`; if you deploy
  without it, submissions still work (it fails open, not shut) but the cap is
  gone.
- **Requests from other sites' pages are refused** when they carry an `Origin`
  header that isn't `ALLOWED_ORIGIN`. This can't stop a script running outside a
  browser — nothing can — which is why the rate limit above matters more.
- Every rejection happens before any GitHub call, so refused traffic costs
  nothing against your API budget.
