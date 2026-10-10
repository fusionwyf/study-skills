(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function makeSortable(table) {
    var headers = table.querySelectorAll("th");
    Array.prototype.forEach.call(headers, function (th, colIndex) {
      th.addEventListener("click", function () {
        var tbody = table.querySelector("tbody") || table;
        var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
        if (!rows.length) return;

        var asc = th.dataset.sortOrder !== "asc";
        Array.prototype.forEach.call(headers, function (h) { delete h.dataset.sortOrder; });
        th.dataset.sortOrder = asc ? "asc" : "desc";

        rows.sort(function (a, b) {
          var aCell = a.children[colIndex];
          var bCell = b.children[colIndex];
          var aText = aCell ? aCell.textContent.trim() : "";
          var bText = bCell ? bCell.textContent.trim() : "";

          var aNum = parseFloat(aText);
          var bNum = parseFloat(bText);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return asc ? aNum - bNum : bNum - aNum;
          }
          return asc ? aText.localeCompare(bText) : bText.localeCompare(aText);
        });

        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    });
  }

  function init() {
    if (typeof document === "undefined") return;
    var tables = document.querySelectorAll("table[data-sortable]");
    Array.prototype.forEach.call(tables, makeSortable);
    if (kit.ready && kit.ready.markReady) kit.ready.markReady("content.table");
  }

  kit.table = {
    init: init
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
