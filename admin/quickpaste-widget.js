// Quick Paste: parses a raw pasted recipe block into the structured
// recipeContent fields (prep/cook time, servings, ingredients, steps).
// Kept dependency-free (no DOM access in the parser) so it can be unit
// tested under plain Node — see docs/CMS-GUIDE.md for the expected format.

function parseQuickPaste(text) {
  var result = {};
  if (!text || !text.trim()) return result;

  var lines = text.replace(/\r\n/g, "\n").split("\n");

  // ---------- prep / cook / servings ----------
  var labelRe = new RegExp(
    "(prep(?:ping)?(?:\\s*time)?|cook(?:ing)?(?:\\s*time)?|bak(?:e|ing)(?:\\s*time)?|serves|servings|yield)\\s*[:\\-]\\s*([^|,\\n]+)",
    "gi"
  );

  var match;
  while ((match = labelRe.exec(text)) !== null) {
    var label = match[1].toLowerCase();
    var value = match[2].trim();

    if (/^prep/.test(label)) {
      var prep = value.match(/(\d+)/);
      if (prep) result.prepTimeMinutes = parseInt(prep[1], 10);
    } else if (/^(cook|bak)/.test(label)) {
      var cook = value.match(/(\d+)/);
      if (cook) result.cookTimeMinutes = parseInt(cook[1], 10);
    } else {
      var servings = value.match(/(\d+)\s*([a-zA-Z]+)?/);
      if (servings) {
        result.servingsNumber = parseInt(servings[1], 10);
        if (servings[2]) {
          var unit = servings[2];
          result.servingsUnit = unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase();
        }
      }
    }
  }

  // ---------- helpers for block extraction ----------
  var INGREDIENTS_HEADING = /^\s*ingredients\s*:?\s*$/i;
  var STEPS_HEADING = /^\s*(instructions|steps|directions|method)\s*:?\s*$/i;
  var ANY_HEADING = /^\s*(ingredients|instructions|steps|directions|method)\s*:?\s*$/i;

  function findHeadingLine(re) {
    for (var i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) return i;
    }
    return -1;
  }

  function nextHeadingAfter(startIndex) {
    for (var i = startIndex + 1; i < lines.length; i++) {
      if (ANY_HEADING.test(lines[i])) return i;
    }
    return lines.length;
  }

  // ---------- ingredients ----------
  var ingHeadingIdx = findHeadingLine(INGREDIENTS_HEADING);
  if (ingHeadingIdx !== -1) {
    var ingEnd = nextHeadingAfter(ingHeadingIdx);
    var ingLines = lines.slice(ingHeadingIdx + 1, ingEnd);
    var ingredients = [];
    for (var i = 0; i < ingLines.length; i++) {
      var raw = ingLines[i].trim();
      if (!raw) continue;
      raw = raw.replace(/^[-*•]\s*/, "");
      ingredients.push(parseIngredientLine(raw));
    }
    if (ingredients.length) result.ingredients = ingredients;
  }

  // ---------- steps ----------
  var stepsHeadingIdx = findHeadingLine(STEPS_HEADING);
  if (stepsHeadingIdx !== -1) {
    var stepsEnd = nextHeadingAfter(stepsHeadingIdx);
    var stepLines = lines.slice(stepsHeadingIdx + 1, stepsEnd);
    result.steps = parseStepLines(stepLines);
  }

  return result;
}

function parseIngredientLine(line) {
  // A "quantity" is a plain number, a fraction, or a mixed number ("1 1/2").
  var QTY = "(?:\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?)";

  // "2 cups flour" / "1 1/2 cups sugar, packed" / "3 large eggs" / "Salt, to taste"
  var withUnit = line.match(
    new RegExp(
      "^(" + QTY + "(?:\\s*[-–]\\s*" + QTY + ")?\\s*(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|l|cloves?|cans?|slices?|pinch(?:es)?|dash(?:es)?))\\s+(.+)$",
      "i"
    )
  );
  if (withUnit) return { amount: withUnit[1].trim(), item: withUnit[2].trim() };

  var bareNumber = line.match(new RegExp("^(" + QTY + ")\\s+(.+)$"));
  if (bareNumber) return { amount: bareNumber[1].trim(), item: bareNumber[2].trim() };

  return { amount: "", item: line };
}

function parseStepLines(stepLines) {
  var numberedRe = /^\s*(\d+)[.)]\s*(.*)$/;
  var hasNumbering = stepLines.some(function (l) {
    return numberedRe.test(l);
  });

  var steps = [];

  if (hasNumbering) {
    var current = null;
    for (var i = 0; i < stepLines.length; i++) {
      var line = stepLines[i];
      var m = line.match(numberedRe);
      if (m) {
        if (current !== null) steps.push(current.trim());
        current = m[2];
      } else if (line.trim()) {
        current = current === null ? line.trim() : current + " " + line.trim();
      }
    }
    if (current !== null && current.trim()) steps.push(current.trim());
  } else {
    for (var j = 0; j < stepLines.length; j++) {
      var text = stepLines[j].trim().replace(/^[-*•]\s*/, "");
      if (text) steps.push(text);
    }
  }

  return steps;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseQuickPaste: parseQuickPaste, parseIngredientLine: parseIngredientLine, parseStepLines: parseStepLines };
}

// ---------------------------------------------------------------------
// Decap CMS widget: a Quick Paste box wired to a composite field holding
// prep/cook time, servings, ingredients, and steps together. Built with
// the `createClass`/`h` globals the decap-cms.js bundle exposes for
// exactly this no-build-tools use case — see docs/CMS-GUIDE.md.
// ---------------------------------------------------------------------
(function () {
  if (typeof createClass === "undefined" || typeof h === "undefined") return; // not running inside the CMS

  var SECTION_STYLE = { marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #eee" };
  var LABEL_STYLE = { display: "block", fontWeight: "600", marginBottom: "6px" };
  var HINT_STYLE = { fontSize: "13px", color: "#666", marginTop: "0", marginBottom: "8px" };
  var ROW_STYLE = { display: "flex", gap: "8px", marginBottom: "8px", alignItems: "flex-start" };
  var INPUT_STYLE = { padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px" };
  var BUTTON_STYLE = { padding: "8px 14px", border: "1px solid #ccc", borderRadius: "4px", background: "#f5f5f5", cursor: "pointer" };
  var REMOVE_BUTTON_STYLE = { padding: "6px 10px", border: "1px solid #ccc", borderRadius: "4px", background: "#fff", cursor: "pointer", color: "#a33" };

  function toPlain(v) {
    if (v && typeof v.toJS === "function") return v.toJS();
    return v || {};
  }

  var QuickPasteControl = createClass({
    getInitialState: function () {
      return { quickPasteText: "", parseMessage: "" };
    },

    getValue: function () {
      var v = toPlain(this.props.value);
      return {
        prepTimeMinutes: v.prepTimeMinutes || "",
        cookTimeMinutes: v.cookTimeMinutes || "",
        servingsNumber: v.servingsNumber || "",
        servingsUnit: v.servingsUnit || "",
        ingredients: v.ingredients || [],
        steps: v.steps || [],
      };
    },

    emit: function (next) {
      this.props.onChange(next);
    },

    handleQuickPasteChange: function (e) {
      this.setState({ quickPasteText: e.target.value });
    },

    handleParseClick: function () {
      var parsed = parseQuickPaste(this.state.quickPasteText);
      var current = this.getValue();
      var filled = [];

      var next = {
        prepTimeMinutes: current.prepTimeMinutes,
        cookTimeMinutes: current.cookTimeMinutes,
        servingsNumber: current.servingsNumber,
        servingsUnit: current.servingsUnit,
        ingredients: current.ingredients,
        steps: current.steps,
      };

      if (parsed.prepTimeMinutes !== undefined) { next.prepTimeMinutes = parsed.prepTimeMinutes; filled.push("prep time"); }
      if (parsed.cookTimeMinutes !== undefined) { next.cookTimeMinutes = parsed.cookTimeMinutes; filled.push("cook time"); }
      if (parsed.servingsNumber !== undefined) { next.servingsNumber = parsed.servingsNumber; filled.push("servings"); }
      if (parsed.servingsUnit !== undefined) { next.servingsUnit = parsed.servingsUnit; }
      if (parsed.ingredients !== undefined) { next.ingredients = parsed.ingredients; filled.push(parsed.ingredients.length + " ingredient" + (parsed.ingredients.length === 1 ? "" : "s")); }
      if (parsed.steps !== undefined) { next.steps = parsed.steps; filled.push(parsed.steps.length + " step" + (parsed.steps.length === 1 ? "" : "s")); }

      this.emit(next);
      this.setState({
        parseMessage: filled.length
          ? "Filled in: " + filled.join(", ") + ". Review below, then Publish."
          : "Nothing recognized in that text — check the format in the CMS guide, or fill the fields below by hand.",
      });
    },

    setField: function (key, value) {
      var current = this.getValue();
      current[key] = value;
      this.emit(current);
    },

    setNumberField: function (key) {
      var self = this;
      return function (e) {
        var raw = e.target.value;
        self.setField(key, raw === "" ? "" : parseInt(raw, 10));
      };
    },

    setTextField: function (key) {
      var self = this;
      return function (e) {
        self.setField(key, e.target.value);
      };
    },

    updateIngredient: function (idx, key, value) {
      var current = this.getValue();
      var ingredients = current.ingredients.slice();
      ingredients[idx] = Object.assign({}, ingredients[idx]);
      ingredients[idx][key] = value;
      current.ingredients = ingredients;
      this.emit(current);
    },

    addIngredient: function () {
      var current = this.getValue();
      current.ingredients = current.ingredients.concat([{ amount: "", item: "" }]);
      this.emit(current);
    },

    removeIngredient: function (idx) {
      var current = this.getValue();
      current.ingredients = current.ingredients.filter(function (_, i) { return i !== idx; });
      this.emit(current);
    },

    updateStep: function (idx, value) {
      var current = this.getValue();
      var steps = current.steps.slice();
      steps[idx] = value;
      current.steps = steps;
      this.emit(current);
    },

    addStep: function () {
      var current = this.getValue();
      current.steps = current.steps.concat([""]);
      this.emit(current);
    },

    removeStep: function (idx) {
      var current = this.getValue();
      current.steps = current.steps.filter(function (_, i) { return i !== idx; });
      this.emit(current);
    },

    render: function () {
      var self = this;
      var value = this.getValue();

      return h(
        "div",
        { className: this.props.classNameWrapper, id: this.props.forID },

        h(
          "div",
          { style: SECTION_STYLE },
          h("label", { style: LABEL_STYLE }, "Quick Paste"),
          h("p", { style: HINT_STYLE }, "Paste your old recipe here — we'll auto-fill the fields below. Please review before publishing."),
          h("textarea", {
            value: this.state.quickPasteText,
            onChange: this.handleQuickPasteChange,
            rows: 10,
            style: Object.assign({}, INPUT_STYLE, { width: "100%", boxSizing: "border-box", fontFamily: "monospace" }),
            placeholder: "Prep time: 15 minutes\nCook time: 30 minutes\nServes: 4\n\nIngredients:\n- 2 cups flour\n...\n\nInstructions:\n1. Preheat oven...",
          }),
          h("div", { style: { marginTop: "8px" } },
            h("button", { type: "button", style: BUTTON_STYLE, onClick: this.handleParseClick }, "Parse & Fill")
          ),
          this.state.parseMessage ? h("p", { style: HINT_STYLE }, this.state.parseMessage) : null
        ),

        h(
          "div",
          { style: SECTION_STYLE },
          h("label", { style: LABEL_STYLE }, "Prep / cook time & servings"),
          h(
            "div",
            { style: ROW_STYLE },
            h("input", { type: "number", min: "0", placeholder: "Prep (min)", style: INPUT_STYLE, value: value.prepTimeMinutes, onChange: this.setNumberField("prepTimeMinutes") }),
            h("input", { type: "number", min: "0", placeholder: "Cook (min)", style: INPUT_STYLE, value: value.cookTimeMinutes, onChange: this.setNumberField("cookTimeMinutes") }),
            h("input", { type: "number", min: "0", placeholder: "Servings #", style: INPUT_STYLE, value: value.servingsNumber, onChange: this.setNumberField("servingsNumber") }),
            h("input", { type: "text", placeholder: "Unit (Servings, Muffins...)", style: INPUT_STYLE, value: value.servingsUnit, onChange: this.setTextField("servingsUnit") })
          )
        ),

        h(
          "div",
          { style: SECTION_STYLE },
          h("label", { style: LABEL_STYLE }, "Ingredients"),
          value.ingredients.map(function (ing, idx) {
            return h(
              "div",
              { style: ROW_STYLE, key: idx },
              h("input", { type: "text", placeholder: "Amount", style: Object.assign({}, INPUT_STYLE, { width: "120px" }), value: ing.amount || "", onChange: function (e) { self.updateIngredient(idx, "amount", e.target.value); } }),
              h("input", { type: "text", placeholder: "Ingredient", style: Object.assign({}, INPUT_STYLE, { flex: "1" }), value: ing.item || "", onChange: function (e) { self.updateIngredient(idx, "item", e.target.value); } }),
              h("button", { type: "button", style: REMOVE_BUTTON_STYLE, onClick: function () { self.removeIngredient(idx); } }, "Remove")
            );
          }),
          h("button", { type: "button", style: BUTTON_STYLE, onClick: this.addIngredient }, "+ Add ingredient")
        ),

        h(
          "div",
          { style: SECTION_STYLE },
          h("label", { style: LABEL_STYLE }, "Steps"),
          value.steps.map(function (step, idx) {
            return h(
              "div",
              { style: ROW_STYLE, key: idx },
              h("textarea", { rows: 2, style: Object.assign({}, INPUT_STYLE, { flex: "1" }), value: step, onChange: function (e) { self.updateStep(idx, e.target.value); } }),
              h("button", { type: "button", style: REMOVE_BUTTON_STYLE, onClick: function () { self.removeStep(idx); } }, "Remove")
            );
          }),
          h("button", { type: "button", style: BUTTON_STYLE, onClick: this.addStep }, "+ Add step")
        )
      );
    },
  });

  var QuickPastePreview = createClass({
    render: function () {
      var v = toPlain(this.props.value);
      var ingredients = v.ingredients || [];
      var steps = v.steps || [];
      return h(
        "div",
        null,
        h("p", null, "Prep: " + (v.prepTimeMinutes || "?") + " min · Cook: " + (v.cookTimeMinutes || "?") + " min · " + (v.servingsNumber || "?") + " " + (v.servingsUnit || "servings")),
        h("p", null, ingredients.length + " ingredients, " + steps.length + " steps")
      );
    },
  });

  CMS.registerWidget("quickpaste", QuickPasteControl, QuickPastePreview);
})();
