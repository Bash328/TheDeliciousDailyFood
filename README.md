# The Delicious Daily

A recipe blog built for Pinterest: a home page of pinnable recipe cards, each linking
to a full recipe page with proper `Recipe` structured data so Pinterest can pull in
cook time, ingredients, and image for a rich recipe pin.

The site is built with **Eleventy** from content files, and edited through a
**Decap CMS** admin panel at `/admin` — no HTML editing required to add, edit, or
remove a recipe. See **[docs/CMS-GUIDE.md](docs/CMS-GUIDE.md)** for the full
day-to-day guide (how to log in, add/edit/delete recipes, and what every config
file does).

## How it fits together

```
_recipes/*.md          ← one file per recipe (edited via /admin, or by hand)
_includes/layouts/      ← the recipe page template
index.njk               ← the homepage template (groups recipes into sections)
_data/                  ← site title/tagline and homepage section config
admin/                  ← the Decap CMS admin panel (config.yml defines its form fields)
oauth-worker/           ← the Cloudflare Worker that makes /admin login work on GitHub Pages
.github/workflows/      ← rebuilds and redeploys the site on every push to main
images/, style.css      ← unchanged, copied through as-is
```

A publish through `/admin` = a commit to this repo = GitHub Actions rebuilds the
site with Eleventy = GitHub Pages serves the new version, automatically.

## Local development

```
npm install
npm run build   # builds the site once into _site/
npm start       # builds and serves it locally with live reload
```

## Adding a new recipe

Normally: go to `/admin` on the live site and fill out the form. See
[docs/CMS-GUIDE.md](docs/CMS-GUIDE.md) for the field-by-field guide.

To add one by hand instead, copy any file in `_recipes/` as a starting point —
the front matter fields are documented in the CMS guide.

## Why the JSON-LD matters

Each recipe page includes a `<script type="application/ld+json">` block describing
the recipe in schema.org's `Recipe` format — ingredients, steps, prep/cook time,
yield. This is what lets Pinterest (and Google) show a proper recipe card instead of
a plain link. It's generated automatically from the recipe's fields — nothing to
maintain by hand.
