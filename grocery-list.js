// Shared grocery-list storage, used by the "Add ingredients" button on every
// recipe page and by the Grocery List tool page. Everything lives in the
// visitor's own browser (localStorage) — nothing is sent to a server.
(function () {
  var STORAGE_KEY = "ddGroceryList";

  function readList() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function writeList(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function addItems(texts) {
    var list = readList();
    var existing = {};
    list.forEach(function (item) {
      existing[item.text.toLowerCase()] = true;
    });
    (texts || []).forEach(function (text) {
      var t = (text || "").trim();
      if (t && !existing[t.toLowerCase()]) {
        list.push({ text: t, checked: false });
        existing[t.toLowerCase()] = true;
      }
    });
    writeList(list);
    return list;
  }

  window.DDGroceryList = { readList: readList, writeList: writeList, addItems: addItems };
})();
