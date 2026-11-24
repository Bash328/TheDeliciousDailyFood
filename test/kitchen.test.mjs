import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { matchLine, recipeKitchen, INGREDIENTS, pageData } = createRequire(import.meta.url)("../lib/kitchen.js");

const names = (item, amount) => {
  const r = matchLine({ item, amount });
  return { names: r.ids.map((i) => INGREDIENTS[i].name).sort(), choice: r.choice, optional: r.optional };
};

test("longest word wins", () => {
  assert.deepEqual(names("chicken broth").names, ["Chicken broth"]);
  assert.deepEqual(names("peanut butter").names, ["Peanut butter"]);
  assert.deepEqual(names("garlic cloves, minced").names, ["Garlic"]);
  assert.deepEqual(names("coconut milk").names, ["Coconut milk"]);
  assert.deepEqual(names("red pepper flakes").names, ["Chili flakes"]);
  assert.deepEqual(names("butternut squash").names, ["Pumpkin"]);
  assert.deepEqual(names("cream of chicken soup").names, ["Condensed soup"]);
});

test("no matches inside other words", () => {
  assert.deepEqual(names("eggplant, cubed").names, ["Eggplant"]);
  assert.deepEqual(names("cornstarch").names, ["Cornstarch"]);
  assert.deepEqual(names("cinnamon or powdered sugar, to roll").names, ["Cinnamon", "Powdered sugar"]);
});

test("brackets only count when nothing outside matches", () => {
  assert.deepEqual(names("amchur (dried mango powder, optional)").names, ["Amchur"]);
  assert.deepEqual(names("rajma (red kidney beans)").names, ["Kidney beans"]);
});

test("or means any, and means all; optional and equipment", () => {
  assert.equal(names("honey or maple syrup").choice, true);
  assert.equal(names("salt and pepper").choice, false);
  assert.equal(names("full-fat dairy (cream, whole milk or yogurt)").choice, true);
  assert.equal(names("lime wedges", "To serve").optional, true);
  assert.equal(names("bamboo skewers").optional, true);
  const k = recipeKitchen([{ item: "salt and pepper" }, { item: "ghee or oil" }, { item: "mystery thing" }, { item: "parsley", amount: "For garnish" }]);
  assert.equal(k.n.length, 3); // salt, pepper, [ghee|oil]
  assert.deepEqual(k.x, ["mystery thing"]);
  assert.equal(k.o.length, 1);
});

test("swap table names real ingredients", () => {
  assert.ok(pageData().swaps.length > 50); // pageData throws on an unknown name
  assert.equal(new Set(INGREDIENTS.map((i) => i.name)).size, INGREDIENTS.length, "duplicate names");
});
