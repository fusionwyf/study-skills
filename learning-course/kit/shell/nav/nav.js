(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function initNav() {
    if (typeof document === "undefined") return;

    var navEls = Array.prototype.slice.call(document.querySelectorAll("nav.kit-nav, nav.course-nav, [data-kit-nav]"));
    var lessonEl = document.querySelector(".lesson");
    var currentLessonId = lessonEl ? lessonEl.dataset.lessonId : null;

    var navData = (kit.config && kit.config.navigation) || kit.__NAV_DATA__ || root.__NAV_DATA__;

    if (navData && Array.isArray(navData.lessons) && navEls.length) {
      var currentLesson = null;
      var curPath = (typeof window !== "undefined" && window.location && window.location.pathname) ? window.location.pathname.split("/").pop() : "";
      for (var i = 0; i < navData.lessons.length; i++) {
        var it = navData.lessons[i];
        if (currentLessonId && (it.number === currentLessonId || String(Number(it.number)) === String(Number(currentLessonId)))) {
          currentLesson = it;
          break;
        }
        if (curPath && it.file && (it.file === curPath || it.file.endsWith("/" + curPath))) {
          currentLesson = it;
          break;
        }
      }

      navEls.forEach(function (nav) {
        if (currentLesson) {
          var homeLink = nav.querySelector('[data-nav-home], a[href*="index.html"]');
          var prevLink = nav.querySelector('[data-nav-prev], a[rel="prev"]');
          var nextLink = nav.querySelector('[data-nav-next], a[rel="next"]');

          if (!prevLink && currentLesson.prev) {
            var aPrev = document.createElement("a");
            aPrev.href = currentLesson.prev.file;
            aPrev.rel = "prev";
            aPrev.dataset.navPrev = "";
            aPrev.className = "nav-prev";
            aPrev.textContent = "← 上一课";
            if (homeLink) nav.insertBefore(aPrev, homeLink);
            else nav.insertBefore(aPrev, nav.firstChild);
          }

          if (!nextLink && currentLesson.next) {
            var aNext = document.createElement("a");
            aNext.href = currentLesson.next.file;
            aNext.rel = "next";
            aNext.dataset.navNext = "";
            aNext.className = "nav-next";
            aNext.textContent = "下一课 →";
            if (homeLink && homeLink.nextSibling) nav.insertBefore(aNext, homeLink.nextSibling);
            else nav.appendChild(aNext);
          }
        }

        var listContainer = nav.querySelector("[data-nav-lessons]");
        if (!listContainer) {
          var details = document.createElement("details");
          details.className = "kit-nav-details";
          var summary = document.createElement("summary");
          summary.textContent = "课时目录";
          details.appendChild(summary);
          listContainer = document.createElement("div");
          listContainer.dataset.navLessons = "";
          details.appendChild(listContainer);
          nav.appendChild(details);
        }

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
