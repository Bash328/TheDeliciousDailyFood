# The Delicious Daily — CMS Guide

This site now builds itself. You add, edit, or delete a recipe through a form at
`/admin`, and the live site updates automatically within about a minute — no HTML,
no code, nothing to touch by hand.

## Day-to-day: logging in and publishing

1. Go to `https://thedeliciousdaily.com/admin/`.
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
| URL slug | Sets the page address (`recipes/<slug>/`). Only change on new recipes, never after publishing. |
| Publish date | Controls sort order and which recipe is the homepage "Latest" feature — the most recent date wins. |
| Category | Which of the 5 homepage sections (Dinner, Lunch, Baking & Dessert, Breakfast, Soup) it appears under. |
| Tag | Optional short word/phrase shown next to the category on the recipe page (e.g. "One Skillet", "Weeknight"). Leave blank if you don't want one. |
| Short description | Used as the card blurb on the homepage, the intro line on the recipe page, the browser/search description, and the Pinterest pin description. One or two sentences. |
| Photo | Upload an image here — it's saved into the `images/` folder automatically and used everywhere the recipe's photo appears. Leave blank and the recipe shows a plain placeholder until you add one. |
| Recipe content | Prep/cook time, servings, ingredients, and steps, all in one field — see **Quick Paste** below, it's the fast way to fill this in. |
| Note | Optional tip shown in a highlighted box at the end of the method. Leave blank to omit it. |

## Quick Paste — auto-fill from a pasted recipe

The **Recipe content** field has a **Quick Paste** box at the top. Paste in an
old recipe as raw text and click **Parse & Fill** — it reads the text and
fills in prep time, cook time, servings, ingredients, and steps below, so you
review/adjust instead of retyping everything by hand.

**Expected format** (labels are flexible, see variants below):
```
Prep time: 15 minutes
Cook time: 30 minutes
Serves: 4

Ingredients:
- 2 cups flour
- 1 tsp salt
- ...

Instructions:
1. Preheat oven to 350°F
2. Mix dry ingredients
3. ...
```

**Variants it understands:**
- "Servings"/"Yield" instead of "Serves"; "Prep"/"Prepping" instead of "Prep
  time"; "Cook"/"Cooking time"/"Bake time"/"Baking time" instead of "Cook time".
- All three on one line: `Prep: 15 min | Cook: 30 min | Serves: 4` (works with
  commas too).
- Ingredients as plain lines with no leading `-`/`*`/`•` — one per line either
  way.
- Steps with no numbers — one per line. If some lines *are* numbered, wrapped
  text on the following line(s) is treated as part of that same step until the
  next number.

**If something doesn't parse right:** Quick Paste only fills in what it's
confident about — a missed field is just left as-is rather than guessing
wrong. Fix it the same way you always would: edit that field directly (add/
remove an ingredient row, retype a step, adjust the amount/item split). The
Quick Paste text itself is never saved — it's just scratch space to seed the
other fields, so there's nothing to clean up afterward. You can also click
**Parse & Fill** again after editing the pasted text; it re-fills based on
whatever's in the box at that moment.

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
- **`admin/quickpaste-widget.js`** — the Quick Paste box and its parsing logic
  (the "Recipe content" field in `/admin`). Runs entirely in your browser, no
  server involved.
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
   - Homepage URL: `https://thedeliciousdaily.com/admin/`
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
