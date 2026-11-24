// How well My Kitchen's ingredient list (lib/kitchen.js) covers the recipes.
// Prints the recipe lines that match nothing (these always show as "missing"),
// most common first, and lines that matched 3+ ingredients (worth a look).
//   node scripts/kitchen-audit.js          summary + top unmatched
//   node scripts/kitchen-audit.js --all    every unmatched and multi-match line
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { INGREDIENTS, matchLine } = require("../lib/kitchen.js");

const all = process.argv.includes("--all");
const dir = path.join(__dirname, "..", "_recipes");
let lines = 0, matched = 0;
const unmatched = new Map(), multi = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
  const ings = (matter(fs.readFileSync(path.join(dir, f), "utf8")).data.recipeContent || {}).ingredients || [];
  for (const ing of ings) {
    lines++;
    const { ids, optional } = matchLine(ing);
    if (ids.length) matched++;
    else if (!optional) unmatched.set(ing.item, (unmatched.get(ing.item) || 0) + 1);
    if (ids.length >= 3) multi.push(`${ing.item}  ->  ${ids.map((i) => INGREDIENTS[i].name).join(", ")}`);
  }
}
console.log(`${matched} of ${lines} lines matched (${((100 * matched) / lines).toFixed(1)}%), ${INGREDIENTS.length} ingredients in the list`);
console.log(`\nUnmatched needed lines (${[...unmatched.values()].reduce((a, b) => a + b, 0)}):`);
[...unmatched].sort((a, b) => b[1] - a[1]).slice(0, all ? Infinity : 60).forEach(([t, n]) => console.log(`  ${n}  ${t}`));
console.log(`\nLines matching 3+ ingredients (${multi.length}):`);
multi.slice(0, all ? Infinity : 40).forEach((l) => console.log("  " + l));
