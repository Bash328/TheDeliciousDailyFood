# The Pinned Kitchen

A recipe blog built for Pinterest: a home page of pinnable recipe cards, each linking
to a full recipe page with proper `Recipe` structured data so Pinterest can pull in
cook time, ingredients, and image for a rich recipe pin.

## Files

```
index.html                     ← the home page / recipe board
style.css                      ← shared styling
recipes/
  brown-butter-cookies.html
  tuscan-chicken.html
  blueberry-muffins.html
  honey-garlic-salmon.html
  potato-soup.html
  strawberry-shortcake.html
```

## Publish it on GitHub Pages

1. Create a new repo on GitHub (any name works for a project site).
2. Upload all these files, keeping the folder structure (the `recipes/` folder must
   stay a folder).
3. In the repo, go to **Settings → Pages**, and under "Build and deployment" choose
   **Deploy from a branch** → `main` → `/ (root)`.
4. Save. Your site goes live in about a minute at
   `https://your-username.github.io/your-repo-name/`.

## Before you publish — three things to swap in

Each recipe page currently uses a colored gradient + emoji as a placeholder photo,
since I can't source real photos for you. For Pinterest to actually work well, swap
these in:

1. **Real photos.** Add a `photo.jpg` for each recipe (an `images/` folder works
   well), then replace `REPLACE_WITH_YOUR_PHOTO_URL.jpg` in each recipe file
   (it appears twice: in the `og:image` meta tag and in the JSON-LD `image` field)
   with the real image URL. Also swap out the `.hero-photo` and `.pin-photo` divs
   in the HTML for `<img>` tags once you have photos.

2. **Real page URLs.** Once your site is live, replace `REPLACE_WITH_PAGE_URL` in
   each recipe's "Save" button with that page's actual URL
   (e.g. `https://your-username.github.io/your-repo/recipes/tuscan-chicken.html`).

3. **Pinterest domain verification (optional but recommended).** To claim your
   site in Pinterest Business settings and unlock analytics on your pins, add the
   meta tag Pinterest gives you into the `<head>` of `index.html`.

## Why the JSON-LD matters

Each recipe page includes a `<script type="application/ld+json">` block describing
the recipe in schema.org's `Recipe` format — ingredients, steps, prep/cook time,
yield. This is what lets Pinterest (and Google) show a proper recipe card instead of
a plain link. You don't need to touch it beyond keeping it in sync if you edit a
recipe's ingredients or steps.

## Adding a new recipe

Copy any file in `recipes/` as a starting point, update the title, ingredients,
steps, and JSON-LD block to match, then add a new `<a class="pin">` card to
`index.html` linking to it.
