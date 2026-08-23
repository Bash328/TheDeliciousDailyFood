# The Delicious Daily — CMS Guide

This site now builds itself. You add, edit, or delete a recipe through a form at
`/admin`, and the live site updates automatically within about a minute — no HTML,
no code, nothing to touch by hand.

## Day-to-day: logging in and publishing

1. Go to `https://bash328.github.io/TheDeliciousDailyFood/admin/`.
2. Click **Login with GitHub** and authorize the app (first time only).
3. You'll see a **Recipes** collection listing every recipe on the site.

### Add a recipe
1. Click **New Recipe**.
2. Fill in the form — see the field reference below.
3. Click **Publish** (top right).
4. That's it. A commit lands in the GitHub repo automatically, which triggers a
   rebuild. The new recipe (and its homepage card, in the right section) appears
   live in roughly 1-2 minutes. Refresh the site to see it.

### Edit a recipe
1. Open it from the Recipes list.
2. Change whatever you like, click **Publish**.
3. Don't change the **URL slug** field on an existing recipe — that's the web
   address, and changing it breaks the old link (including anything already
   pinned on Pinterest). Everything else is safe to edit anytime.

### Delete a recipe
Open it, click the menu next to Publish → **Delete entry**. It disappears from
the live site on the next rebuild.

## Field reference

| Field | What it does |
|---|---|
| Title | The recipe name shown everywhere. |
| URL slug | Sets the page address (`recipes/<slug>.html`). Only change on new recipes, never after publishing. |
| Publish date | Controls sort order and which recipe is the homepage "Latest" feature — the most recent date wins. |
| Category | Which of the 5 homepage sections (Dinner, Lunch, Baking & Dessert, Breakfast, Soup) it appears under. |
| Tag | Optional short word/phrase shown next to the category on the recipe page (e.g. "One Skillet", "Weeknight"). Leave blank if you don't want one. |
| Short description | Used as the card blurb on the homepage, the intro line on the recipe page, the browser/search description, and the Pinterest pin description. One or two sentences. |
| Photo | Upload an image here — it's saved into the `images/` folder automatically and used everywhere the recipe's photo appears. Leave blank and the recipe shows a plain placeholder until you add one. |
| Prep time / Cook time | In minutes. Used for the stat strip and the recipe's structured data (what lets Pinterest/Google show rich recipe cards). |
| Servings number / unit | E.g. "4" + "Servings", or "12" + "Muffins", or "1" + "Loaf" — whatever fits the recipe. |
| Ingredients | One row per ingredient: an **Amount** (e.g. "2 cups", "1 tbsp" — leave blank for things like "Salt, to taste") and the **Ingredient** itself. Click "Add ingredient" to add rows. |
| Steps | One row per numbered step. Click "Add step" to add more. |
| Note | Optional tip shown in a highlighted box at the end of the method. Leave blank to omit it. |

## What each file does (for future reference — you shouldn't need to touch these)

- **`.eleventy.js`** — configuration for Eleventy, the tool that turns the
  `_recipes/*.md` files + templates into the actual HTML pages in `_site/`.
- **`_data/site.js`** — the site's name, tagline, and base URL.
- **`_data/sections.js`** — the 5 homepage sections, their order, and which
  category belongs in which section.
- **`_includes/layouts/recipe.njk`** — the template every recipe page is built
  from. Change this once and every recipe updates.
- **`index.njk`** — the homepage template; loops through recipes and groups them
  into sections automatically.
- **`_recipes/*.md`** — the actual recipe content. Decap CMS reads and writes
  these files directly; you'll basically never open them yourself.
- **`admin/config.yml`** — defines the form fields you see in `/admin`. If you
  ever want to add/remove/rename a field, this is the one file to edit (and it's
  a good one to hand to Claude Code with a plain-English request rather than
  editing by hand).
- **`.github/workflows/deploy.yml`** — the GitHub Action that rebuilds and
  republishes the site every time a commit lands on `main` (i.e., every time you
  hit Publish in the CMS, or anyone pushes a code change).
- **`oauth-worker/worker.js`** — a small relay that lets Decap CMS's "Login with
  GitHub" button work on a GitHub Pages site. It's the piece that hands your
  browser a GitHub access token after you approve the login — GitHub Pages can't
  do this by itself, hence the extra service. See the setup steps below for how
  it's wired up.

## One-time setup steps (already documented for the record — only needed once)

These five steps had to happen outside Claude Code, under your own GitHub and
Cloudflare accounts, before `/admin` could work:

1. **GitHub Pages build source** — Settings → Pages → Source → **GitHub Actions**
   (instead of "Deploy from a branch").
2. **Deploy `oauth-worker/worker.js`** as a Cloudflare Worker (free account,
   dashboard's Quick Edit — no install needed) → note its `*.workers.dev` URL.
3. **Create a GitHub OAuth App** at github.com/settings/developers → New OAuth
   App:
   - Homepage URL: `https://bash328.github.io/TheDeliciousDailyFood/admin/`
   - Authorization callback URL: `<your-worker-url>/callback`
   - Copy the **Client ID**, generate and copy a **Client Secret**.
4. **Add those two values to the Worker** as secrets named `GITHUB_CLIENT_ID`
   and `GITHUB_CLIENT_SECRET` (Cloudflare dashboard → Worker → Settings →
   Variables and Secrets).
5. **Paste the Worker URL into `admin/config.yml`**, replacing the
   `base_url: "<<< PASTE WORKER URL HERE >>>"` placeholder, then commit and push
   that one-line change.

If you ever need to redo any of this (new OAuth app, moved to a different
Worker, etc.), this list is the whole procedure.
