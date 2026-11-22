// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { parseQuickPaste, parseIngredientLine } = createRequire(import.meta.url)(
  "../admin/quickpaste-widget.js"
);

const recipe = `Prep time: 15 minutes
Cook time: 60 minutes
Serves: 8 loaves

Ingredients:
- 2 cups flour
- 1 1/2 cups sugar, packed
- ½ cup butter
- 1½ tsp vanilla
- Salt, to taste

Instructions:
1. Preheat the oven to 350F.
2. Bake - 25 minutes, then cover with foil.
3. Cool before slicing.`;

test("times, servings, ingredients and steps are all picked up", () => {
  const r = parseQuickPaste(recipe);
  assert.equal(r.prepTimeMinutes, 15);
  assert.equal(r.servingsNumber, 8);
  assert.equal(r.servingsUnit, "Loaves");
  assert.equal(r.ingredients.length, 5);
  assert.deepEqual(r.ingredients[0], { amount: "2 cups", item: "flour" });
  assert.equal(r.steps.length, 3);
});

test("a method step can't overwrite the real cook time", () => {
  assert.equal(parseQuickPaste(recipe).cookTimeMinutes, 60);
});

test("unicode fractions land in the amount, not the ingredient name", () => {
  assert.deepEqual(parseIngredientLine("½ cup butter"), { amount: "½ cup", item: "butter" });
  assert.deepEqual(parseIngredientLine("1½ tsp vanilla"), { amount: "1½ tsp", item: "vanilla" });
});

test("text with no recognisable parts gives an empty result", () => {
  assert.deepEqual(parseQuickPaste("just some words"), {});
  assert.deepEqual(parseQuickPaste(""), {});
});
