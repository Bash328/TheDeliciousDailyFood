// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSubmission, normalizeInstagram } from "./validate.js";
import { codeSpan } from "./worker.js";

const base = {
  title: "Banana Bread",
  category: "Dessert",
  description: "A soft, easy loaf that uses up the bananas going brown on the counter.",
  hasImage: true,
  raw: `Prep time: 15 min
Cook time: 60 min
Serves: 8

Ingredients:
- 3 ripe bananas
- 2 cups flour
- 1/2 cup sugar
- 1 tsp baking soda

Instructions:
1. Preheat the oven to 350F and grease a loaf tin.
2. Mash the bananas and stir in the sugar.
3. Fold in the flour and baking soda, then bake for an hour.`,
};

// The exact outline the form starts people with (submit-recipe.njk).
const blankTemplate = `Prep time:
Cook time:
Serves:

Ingredients:
-
-
-
-

Instructions:
1.
2.
3.`;

test("a complete recipe passes", () => {
  assert.equal(validateSubmission(base), null);
});

test("the untouched template is refused on the recipe field", () => {
  const problem = validateSubmission({ ...base, raw: blankTemplate });
  assert.equal(problem.field, "raw");
  assert.match(problem.message, /blank outline/);
});

test("a photo is required", () => {
  assert.equal(validateSubmission({ ...base, hasImage: false }).field, "photo");
});

test("instagram handles are reduced to a bare handle or refused", () => {
  assert.equal(normalizeInstagram("@jamie.cooks"), "jamie.cooks");
  assert.equal(normalizeInstagram("https://www.instagram.com/jamie_cooks/"), "jamie_cooks");
  assert.equal(normalizeInstagram("https://evil.example/x"), null);
  assert.equal(validateSubmission({ ...base, instagram: "not a handle!" }).field, "instagram");
});

test("visitor text in the PR body can't escape its code span", () => {
  assert.equal(codeSpan("hi @someone"), "` hi @someone `");
  assert.equal(codeSpan("a ``b`` c"), "``` a ``b`` c ```");
  assert.equal(codeSpan("line one\n\nline two"), "` line one line two `");
});
