// What counts as a submittable recipe. One copy of the rules, used twice:
//
//   - the worker imports it and enforces it (this is the one that matters —
//     anything can POST to the endpoint, form or not);
//   - the build inlines this same file into /submit-recipe/ so the page can
//     check before sending, and a person gets told what's missing while
//     they're still looking at the form rather than after a round trip.
//
// That's why it's written as plain functions with a single `export` line at
// the bottom: .eleventy.js strips that line when inlining it into the page.
// Keep it dependency-free and free of anything a browser wouldn't understand.
//
// The messages here are read by real people mid-submission, so each one says
// what's wrong AND what to do about it.

var SUBMISSION_CATEGORIES = ["Dinner", "Lunch", "Dessert", "Breakfast", "Soup"];

var SUBMISSION_LIMITS = {
  titleMin: 3,
  titleMax: 120,
  descriptionMin: 20,
  descriptionMax: 280,
  rawMin: 120,
  rawMax: 6000,
  minIngredientLines: 3,
  minSteps: 2,
  maxLinksInRecipe: 2,
  imageMaxBytes: 4 * 1024 * 1024,
};

// A step usually opens with an instruction, optionally behind "1." or a
// bullet. Matching on the opening word rather than "contains a cooking verb
// somewhere" is what keeps "1 cup melted butter" out of the step count.
var STEP_OPENER =
  /^\s*(?:\d+[.)]\s*|[-*•]\s*)?(?:then\s+|next\s+|now\s+|finally\s+)?(preheat|heat|bake|roast|grill|fry|saute|sauté|sear|simmer|boil|steam|poach|mix|stir|whisk|fold|knead|combine|blend|chop|slice|dice|mince|peel|grate|season|pour|cover|drain|serve|garnish|toss|spread|assemble|melt|marinate|transfer|beat|bring|cook|prepare|arrange|remove|add|refrigerate|chill|wash|rinse|soak|scoop|shape|roll|flip|turn|sprinkle|drizzle|squeeze|line|grease|repeat|let|leave|allow|divide|scrape|deglaze|strain|reserve|top|finish)\b/i;

// An ingredient line carries an amount: a number, or a fraction character, or
// a measure word.
var HAS_AMOUNT =
  /(\d|[¼-¾⅐-⅞]|\b(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|grams?|kgs?|kilos?|kilograms?|ml|millilitres?|milliliters?|l|litres?|liters?|oz|ounces?|lbs?|pounds?|cloves?|pinch(?:es)?|cans?|jars?|slices?|sprigs?|sticks?|handfuls?|packets?|packs?|bunch(?:es)?|quarts?|pints?|gallons?|dash(?:es)?|knobs?|splash(?:es)?)\b)/i;

var LINK_PATTERN = /(https?:\/\/|www\.)\S+/gi;

function countLinks(text) {
  var found = text.match(LINK_PATTERN);
  return found ? found.length : 0;
}

function nonEmptyLines(text) {
  return text.split(/\r?\n/).map(function (line) {
    return line.trim();
  }).filter(Boolean);
}

// Steps are counted across both lines and sentences, so a recipe written as a
// paragraph ("Preheat the oven. Mix the dry ingredients.") counts the same as
// one written as a numbered list.
function countSteps(text) {
  // Sentence ends become line breaks first, then everything splits on lines.
  // (Deliberately not a lookbehind — older Safari throws on those at parse
  // time, which would take the whole inline script on the form down with it.)
  var segments = text
    .replace(/([.!?])\s+/g, "$1\n")
    .split(/\r?\n/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var steps = 0;
  for (var i = 0; i < segments.length; i++) {
    if (STEP_OPENER.test(segments[i]) && segments[i].split(/\s+/).length >= 3) {
      steps++;
    }
  }
  return steps;
}

function countIngredientLines(text) {
  var lines = nonEmptyLines(text);
  var count = 0;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    // Long prose isn't an ingredient line, and an instruction isn't either
    // even though it often carries a number ("Bake for 30 minutes").
    if (line.length <= 120 && HAS_AMOUNT.test(line) && !STEP_OPENER.test(line)) {
      count++;
    }
  }
  return count;
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

// Returns null when the submission is fine, or { field, message } for the
// first problem found. Fields are checked in the order they appear on the
// form, so the message always points at the earliest thing to fix.
//
// `submission` is { title, category, description, raw, hasImage }.
function validateSubmission(submission) {
  var title = (submission.title || "").trim();
  var category = (submission.category || "").trim();
  var description = (submission.description || "").trim();
  var raw = (submission.raw || "").trim();
  var L = SUBMISSION_LIMITS;

  if (title.length < L.titleMin || !/[a-z]{2}/i.test(title)) {
    return { field: "title", message: "Give the recipe a real name." };
  }
  if (title.length > L.titleMax || countLinks(title) > 0) {
    return { field: "title", message: "That title can't be used — keep it short and leave links out." };
  }

  if (SUBMISSION_CATEGORIES.indexOf(category) === -1) {
    return { field: "category", message: "Pick a category." };
  }

  if (description.length < L.descriptionMin || wordCount(description) < 4) {
    return {
      field: "description",
      message: "Add a short description — a sentence about what it is and why it's worth making.",
    };
  }
  if (description.length > L.descriptionMax || countLinks(description) > 0) {
    return {
      field: "description",
      message: "Keep the description to a sentence or two, with no links.",
    };
  }

  if (!submission.hasImage) {
    return {
      field: "photo",
      message: "A photo of the finished dish is required — add one to send this in.",
    };
  }

  if (raw.length < L.rawMin) {
    return {
      field: "raw",
      message: "The recipe itself is too short. Include the ingredients and the steps to make it.",
    };
  }
  if (raw.length > L.rawMax) {
    return {
      field: "raw",
      message: "That recipe is longer than this form takes. Trim it to the essentials.",
    };
  }
  if (countLinks(raw) > L.maxLinksInRecipe) {
    return {
      field: "raw",
      message: "Please send the recipe itself rather than links to it.",
    };
  }
  if (countIngredientLines(raw) < L.minIngredientLines) {
    return {
      field: "raw",
      message:
        "List the ingredients with their amounts, one per line — at least " +
        L.minIngredientLines + " of them (for example: 2 cups flour).",
    };
  }
  if (countSteps(raw) < L.minSteps) {
    return {
      field: "raw",
      message:
        "Include the method — at least " + L.minSteps +
        " steps saying what to do (for example: Preheat the oven to 350°F).",
    };
  }

  return null;
}

export { validateSubmission, SUBMISSION_LIMITS, SUBMISSION_CATEGORIES };
