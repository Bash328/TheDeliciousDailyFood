# Reader accounts — setup

What it gives readers: sign in with an emailed one-time link (no password), a
**Save recipe** button on every recipe, and a grocery list that follows them
between devices. Nothing is switched on until the last step below.

Pieces:

| Piece | Where | What it does |
|---|---|---|
| `api-worker/` | Cloudflare Worker at `api.thedeliciousdaily.com` + D1 database | Sign-in, sessions, saved recipes, grocery list |
| `app.js`, `account.njk` | the public site | Save button, the `/account/` page, grocery sync |
| Resend | resend.com (free tier) | Sends the sign-in emails |

Why a subdomain: the site and the API must share a registrable domain so the
sign-in cookie counts as "same-site". A `*.workers.dev` address won't work.

## One-time setup (you do this; needs your accounts)

Run the `wrangler` commands from the `api-worker/` folder, and keep the
`--config wrangler.toml` on each one: without it wrangler finds the repo-root
`wrangler.jsonc` (the admin site) instead. First time only: `npx wrangler login`.

1. **Resend** — sign up at resend.com → Domains → add `thedeliciousdaily.com`
   and add the DNS records it shows (in Cloudflare DNS) → API Keys → create one.
2. **Create the database:** `npx wrangler d1 create delicious-daily`. Copy the
   `database_id` it prints into `api-worker/wrangler.toml`.
3. **Create the tables:**
   `npx wrangler d1 execute delicious-daily --remote --file=schema.sql --config wrangler.toml`
4. **Set the secrets:**
   `npx wrangler secret put RESEND_API_KEY --config wrangler.toml` (paste the key).
   Optional, once Turnstile is on: `npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.toml`.
5. **Deploy:** `npx wrangler deploy --config wrangler.toml`. Cloudflare creates the
   `api.thedeliciousdaily.com` DNS record itself. Check
   `https://api.thedeliciousdaily.com/me` answers `{"error":"not signed in"}`.
6. **Switch it on:** in `_data/site.js` set
   `accountsApi: "https://api.thedeliciousdaily.com"`, commit and push. The
   Account link, the Save buttons and grocery sync appear after the deploy.
7. **Try it:** open the site, tap Account, sign in with your own email, save a
   recipe, add a grocery item, then sign in on your phone and check both are there.

## Things to know

- **Limits:** 5 sign-in emails an hour per address, 5 requests a minute per IP,
  500 saved recipes and 300 grocery items per person. Turn on Turnstile
  (`docs/TODO.md`) and it protects this form too, with the same site key.
- **Privacy:** the policy already describes accounts. Users can delete their
  account from `/account/`; that erases their rows.
- **Backups:** D1 has Time Travel (30-day point-in-time restore) on by default.
- **Changing the site address:** update `ALLOWED_ORIGIN` and `SITE_URL` in
  `api-worker/wrangler.toml` and redeploy, or sign-in will be refused.
- **Tests:** `npm test` runs the API against a real SQLite database (Node 22.5+).
