(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function initNav() {
    if (typeof document === "undefined") return;

    var navEls = document.querySelectorAll("nav.kit-nav, [data-kit-nav]");
    var lessonEl = document.querySelector(".lesson");
    var currentLessonId = lessonEl ? lessonEl.dataset.lessonId : null;

    var navData = (kit.config && kit.config.navigation) || kit.__NAV_DATA__ || root.__NAV_DATA__;

    if (navData && navData.lessons && navEls.length) {
      navEls.forEach(function (nav) {
        var listContainer = nav.querySelector("[data-nav-lessons]");
        if (listContainer && !listContainer.children.length) {
          var ol = document.createElement("ol");
          ol.className = "kit-nav-list";
          navData.lessons.forEach(function (item) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = item.file;
            a.textContent = "第 " + item.number + " 课：" + item.title;
            if (currentLessonId && (item.number === currentLessonId || String(Number(item.number)) === String(Number(currentLessonId)))) {
              li.className = "is-current";
              a.setAttribute("aria-current", "page");
            }
            li.appendChild(a);
            ol.appendChild(li);
          });
          listContainer.appendChild(ol);
        }
      });
    }

    // Keyboard navigation shortcuts: [ for prev, ] for next
    document.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (e.target && e.target.isContentEditable)) {
        return;
      }
      if (e.key === "[" || (e.altKey && e.key === "ArrowLeft")) {
        var prev = document.querySelector('[data-nav-prev], a[rel="prev"]');
        if (prev && prev.href) prev.click();
      } else if (e.key === "]" || (e.altKey && e.key === "ArrowRight")) {
        var next = document.querySelector('[data-nav-next], a[rel="next"]');
        if (next && next.href) next.click();
      }
    });

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("shell.nav");
    }
  }

  kit.nav = {
    init: initNav
  };

  if (kit.registerModule) {
    kit.registerModule("shell.nav", kit.nav);
  }
})(typeof window !== "undefined" ? window : globalThis);
