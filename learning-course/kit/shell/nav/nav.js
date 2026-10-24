(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function getLessonHref(file, isLessonPage) {
    var baseFile = file.indexOf("/") !== -1 ? file.split("/").pop() : file;
    return isLessonPage ? baseFile : ("lessons/" + baseFile);
  }

  /* ---------------------------------------------------------------------------
   * Chaptered packages restart lesson numbers at 0001 per chapter, so a bare
   * number is not a unique identity. nav.json entries therefore carry:
   *   file  - path relative to lessons/ ("第九章/0001-x.html", or "0001-x.html")
   *   key   - composite progress key ("第九章/0001", or "0001")
   * and links are resolved relative to the current page instead of by number.
   * ------------------------------------------------------------------------- */

  function lessonKey(entry) {
    if (!entry) return "";
    if (entry.key) return entry.key;
    var number = entry.number == null ? "" : String(Number(entry.number));
    return entry.chapter ? (entry.chapter + "/" + number) : number;
  }

  function normalizePath(pathname) {
    return String(pathname || "").split("\\").join("/");
  }

  // lessons/-relative path of the page, derived from the URL, or "" when unknown
  function pageLessonFile() {
    if (typeof window === "undefined" || !window.location) return "";
    var pathname = normalizePath(window.location.pathname);
    var marker = "/lessons/";
    var index = pathname.lastIndexOf(marker);
    if (index === -1) return "";
    return pathname.slice(index + marker.length).replace(/^\/+/, "");
  }

  /** Relative href between two lessons/-relative paths; mirrors build_index.lesson_href. */
  function relLessonHref(fromFile, toFile) {
    if (!fromFile) return "lessons/" + toFile;
    var fromDir = fromFile.indexOf("/") === -1 ? [] : fromFile.split("/").slice(0, -1);
    var toParts = String(toFile).split("/");
    var common = 0;
    while (common < fromDir.length && common < toParts.length - 1 && fromDir[common] === toParts[common]) {
      common += 1;
    }
    var up = [];
    for (var i = common; i < fromDir.length; i += 1) up.push("..");
    return up.concat(toParts.slice(common)).join("/");
  }

  /** Where nav.json lives, resolved from the kit.js tag so any depth works. */
  function navJsonUrl(fallbackUrl) {
    if (typeof document === "undefined") return fallbackUrl;
    var kitScript = document.querySelector('script[src*="kit.js"]');
    if (!kitScript) return fallbackUrl;
    var src = kitScript.getAttribute("src") || "";
    var match = src.match(/^(.*?)kit\.js/);
    if (!match) return fallbackUrl;
    // kitDir is "<base>/assets/kit/"; nav.json sits at "<base>/assets/course/nav.json".
    var kitDir = match[1];
    var assetsDir = kitDir.replace(/assets\/kit\/$/, "assets/");
    if (assetsDir === kitDir) return fallbackUrl;
    return assetsDir + "course/nav.json";
  }

  function renderSidebar(navData, currentLessonId, currentLesson) {
    var page = document.querySelector(".kit-page, .course-shell");
    if (!page) return;

    var sidebar = document.querySelector(".kit-sidebar");
    if (!sidebar) {
      sidebar = document.createElement("aside");
      sidebar.className = "kit-sidebar";
      sidebar.setAttribute("aria-label", "课程大纲");
      page.insertBefore(sidebar, page.firstChild);
    }

    var isLessonPage = !!document.querySelector(".lesson, [data-lesson-id]");
    var lessons = (navData && navData.lessons) || [];
    var currentIndex = -1;
    var pageFile = isLessonPage ? pageLessonFile() : "";

    if (isLessonPage) {
      // Exact lessons/-relative path wins: it is the only identity that stays
      // unique when two chapters both contain a 0001.
      for (var i = 0; i < lessons.length; i += 1) {
        if (pageFile && lessons[i].file === pageFile) { currentIndex = i; break; }
      }
      if (currentIndex === -1 && currentLesson) {
        for (var j = 0; j < lessons.length; j += 1) {
          if (lessonKey(lessons[j]) && lessonKey(lessons[j]) === lessonKey(currentLesson)) { currentIndex = j; break; }
        }
      }
      if (currentIndex === -1 && currentLessonId != null) {
        for (var k = 0; k < lessons.length; k += 1) {
          var candidate = lessons[k];
          if (!candidate.chapter && String(Number(candidate.number)) === String(Number(currentLessonId))) { currentIndex = k; break; }
        }
      }
    }

    var totalLessons = lessons.length;

    // Course progress: judged strictly based on records (completed_lessons)
    var completedList = (navData && Array.isArray(navData.completed_lessons)) ? navData.completed_lessons : null;

    function isLessonCompleted(it, idx) {
      if (completedList !== null) {
        var numStr = it.number ? String(Number(it.number)) : String(idx + 1);
        if (numStr.length < 4) {
          numStr = ("0000" + numStr).slice(-4);
        }
        // Chaptered packages key progress on "<章>/<NNNN>"; a bare number would
        // wrongly mark every chapter's same-numbered lesson as done.
        var key = lessonKey(it);
        if (key && completedList.indexOf(key) !== -1) return true;
        if (!it.chapter) {
          return completedList.indexOf(numStr) !== -1 || completedList.indexOf(it.number) !== -1;
        }
        return false;
      }
      if (navData && typeof navData.current_lesson !== "undefined" && navData.current_lesson !== null) {
        var lNum = it.number ? Number(it.number) : (idx + 1);
        return lNum <= Number(navData.current_lesson);
      }
      return false;
    }

    var completedCount = 0;
    if (completedList !== null) {
      completedCount = completedList.length;
    } else if (navData && typeof navData.completed_count !== "undefined") {
      completedCount = Number(navData.completed_count);
    } else if (navData && typeof navData.current_lesson !== "undefined") {
      completedCount = Number(navData.current_lesson);
    } else {
      completedCount = (currentIndex !== -1) ? (currentIndex + 1) : 0;
    }
    if (isNaN(completedCount) || completedCount < 0) completedCount = 0;
    if (completedCount > totalLessons) completedCount = totalLessons;

    var progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    // Generic course metadata resolution (from nav.json / course config or DOM)
    var courseTitle = (navData && navData.title) || "";
    if (!courseTitle) {
      var courseNavHome = document.querySelector(".course-nav a, .kit-nav a");
      if (courseNavHome && courseNavHome.textContent && courseNavHome.textContent.trim() !== "课程首页") {
        courseTitle = courseNavHome.textContent.trim();
      }
    }
    if (!courseTitle) {
      var lessonScope = document.querySelector(".lesson[data-course-id]");
      if (lessonScope && lessonScope.dataset.courseId) {
        courseTitle = lessonScope.dataset.courseId;
      } else {
        courseTitle = "课程目录";
      }
    }

    // Optional short course code
    var courseCode = (navData && navData.code) || "";
    if (!courseCode && navData && navData.course_id && navData.course_id.length <= 10 && !navData.course_id.includes("-")) {
      courseCode = navData.course_id;
    }

    // Optional unit meta
    var unitMeta = (navData && navData.unit) || "";
    if (!unitMeta) {
      var kickerEl = document.querySelector(".course-header .course-kicker, .kit-header .course-kicker");
      if (kickerEl) {
        var kickerText = kickerEl.textContent.trim();
        var unitMatch = kickerText.match(/(?:UNIT|单元|第\s*[一二三四五六七八九十\d]+\s*单元)\s*[\d\w]*[\s·\/:：-]*[^\s·\/:：-]+/i);
        if (unitMatch) {
          unitMeta = unitMatch[0];
        }
      }
    }

    var currentEntry = currentIndex >= 0 ? lessons[currentIndex] : null;
    var homeLink = "index.html";
    if (isLessonPage) {
      homeLink = (currentEntry && currentEntry.home) || (navData && navData.home) || "../index.html";
    }

    var html = [];
    html.push('<div class="kit-sidebar__brand">');
    html.push('  <a href="' + homeLink + '" class="kit-sidebar__home-link">');
    if (courseCode) {
      html.push('    <span class="kit-sidebar__code">' + courseCode + '</span>');
      html.push('    <span class="kit-sidebar__sep">·</span>');
    }
    html.push('    <span class="kit-sidebar__course-name">' + courseTitle + '</span>');
    html.push('  </a>');
    if (unitMeta) {
      html.push('  <div class="kit-sidebar__unit-meta">' + unitMeta + '</div>');
    }
    html.push('  <div class="kit-sidebar__progress-row">');
    html.push('    <span class="kit-sidebar__progress-label">课程进度</span>');
    html.push('    <span class="kit-sidebar__progress-count">' + completedCount + ' / ' + totalLessons + '</span>');
    html.push('  </div>');
    html.push('  <div class="kit-sidebar__progress-track" aria-hidden="true">');
    html.push('    <div class="kit-sidebar__progress-bar" style="width: ' + progressPercent + '%;"></div>');
    html.push('  </div>');
    html.push('</div>');

    html.push('<nav class="kit-sidebar__tree" aria-label="课时列表">');
    html.push('  <div class="kit-sidebar__tree-title">章节目录</div>');

    var hrefFromFile = "";
    if (isLessonPage) {
      hrefFromFile = pageFile || (currentIndex >= 0 && lessons[currentIndex] ? lessons[currentIndex].file : "");
    }

    function renderLessonItem(it, idx, indent) {
      var isCurrent = (idx === currentIndex);
      var isCompleted = isLessonCompleted(it, idx);
      var itemClass = "kit-sidebar__item" + (isCurrent ? " is-current" : "") + (isCompleted ? " is-completed" : "");

      var numLabel = it.number ? String(Number(it.number)) : String(idx + 1);
      if (numLabel.length < 2) numLabel = "0" + numLabel;

      var statusMarker = isCurrent
        ? '<span class="kit-sidebar__marker is-current" aria-label="当前课时">●</span>'
        : (isCompleted
            ? '<span class="kit-sidebar__marker is-done" aria-label="已完成">✓</span>'
            : '<span class="kit-sidebar__marker is-todo">' + numLabel + '</span>');

      var lessonHref;
      if (!it.file) {
        lessonHref = "#";
      } else if (hrefFromFile) {
        // Lesson page: relative to the current lesson's chapter directory
        lessonHref = relLessonHref(hrefFromFile, it.file);
      } else if (it.href) {
        // Course index: the stored index-relative path keeps the chapter segment
        lessonHref = it.href;
      } else {
        lessonHref = "lessons/" + it.file;
      }

      var pad = indent ? "  " : "";
      html.push(pad + '    <li class="' + itemClass + '">');
      html.push(pad + '      <a href="' + lessonHref + '" class="kit-sidebar__link"' + (isCurrent ? ' aria-current="page"' : '') + '>');
      html.push(pad + '        ' + statusMarker);
      html.push(pad + '        <span class="kit-sidebar__link-text">');
      html.push(pad + '          <span class="kit-sidebar__link-title" title="' + it.title + '">' + it.title + '</span>');
      html.push(pad + '        </span>');
      html.push(pad + '      </a>');
      html.push(pad + '    </li>');
    }

    function chapterLabel(entry) {
      if (!entry || !entry.chapter) return "";
      for (var c = 0; c < (navData.chapters || []).length; c += 1) {
        var meta = navData.chapters[c];
        if (meta && (meta.label === entry.chapter || meta.id === entry.chapter)) {
          return meta.title && meta.title !== meta.label ? (meta.label + " · " + meta.title) : meta.label;
        }
      }
      return entry.chapter;
    }

    var chapterGroups = [];
    lessons.forEach(function (it, idx) {
      var label = it.chapter ? chapterLabel(it) : "";
      var last = chapterGroups[chapterGroups.length - 1];
      if (!last || last.label !== label) chapterGroups.push({ label: label, items: [] });
      chapterGroups[chapterGroups.length - 1].items.push(idx);
    });
    var grouped = chapterGroups.length > 1 || (chapterGroups.length === 1 && chapterGroups[0].label);

    if (!grouped) {
      html.push('  <ul class="kit-sidebar__list">');
      lessons.forEach(function (it, idx) { renderLessonItem(it, idx, false); });
      html.push('  </ul>');
    } else {
      chapterGroups.forEach(function (group) {
        html.push('  <div class="kit-sidebar__group">');
        html.push('    <div class="kit-sidebar__group-title">' + group.label + '</div>');
        html.push('    <ul class="kit-sidebar__list">');
        group.items.forEach(function (idx) { renderLessonItem(lessons[idx], idx, true); });
        html.push('    </ul>');
        html.push('  </div>');
      });
    }

    html.push('</nav>');

    sidebar.innerHTML = html.join("\n");

    // Close sidebar drawer on link click for mobile/tablet
    sidebar.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (a) {
        sidebar.classList.remove("is-open");
        var b = document.querySelector(".kit-sidebar-backdrop");
        if (b) b.classList.remove("is-open");
      }
    });

    // Add backdrop for mobile/tablet drawer
    var backdrop = document.querySelector(".kit-sidebar-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "kit-sidebar-backdrop";
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", function () {
        sidebar.classList.remove("is-open");
        backdrop.classList.remove("is-open");
      });
    }

    // Toggle button in header if present
    var header = document.querySelector(".course-header, .kit-header");
    if (header && !header.querySelector(".kit-sidebar-toggle")) {
      var toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "kit-sidebar-toggle";
      toggleBtn.innerHTML = "☰ <span>课程大纲</span>";
      toggleBtn.addEventListener("click", function () {
        var isOpen = sidebar.classList.toggle("is-open");
        backdrop.classList.toggle("is-open", isOpen);
      });
      header.insertBefore(toggleBtn, header.firstChild);
    }
  }

  /**
   * Resolve a prev/next reference to its lesson entry.
   *
   * Matching on the number alone is unsafe in a chaptered package (both chapters
   * own a 0001), so the composite key, then file, then number+chapter are tried
   * before falling back to a bare number for flat courses.
   */
  function findLesson(data, ref) {
    if (!data || !Array.isArray(data.lessons) || !ref) return null;
    var lessons = data.lessons;
    var i;
    if (ref.key) {
      for (i = 0; i < lessons.length; i += 1) if (lessonKey(lessons[i]) === ref.key) return lessons[i];
    }
    if (ref.file) {
      for (i = 0; i < lessons.length; i += 1) if (lessons[i].file === ref.file) return lessons[i];
    }
    if (ref.number != null) {
      var targetStr = String(Number(ref.number));
      if (ref.chapter) {
        for (i = 0; i < lessons.length; i += 1) {
          if (lessons[i].chapter === ref.chapter && String(Number(lessons[i].number)) === targetStr) return lessons[i];
        }
      }
      for (i = 0; i < lessons.length; i += 1) {
        var it = lessons[i];
        if (!it.chapter && it.number && (it.number === ref.number || String(Number(it.number)) === targetStr)) return it;
      }
    }
    return ref;
  }

  /**
   * Href from the current lesson page to a prev/next reference.
   *
   * The ref stored beside a lesson carries an href already relative to that
   * lesson. A resolved lesson entry carries an index-relative href, which must
   * not be reused here, so only the reference's own href is trusted.
   */
  function lessonLinkHref(currentLesson, ref, resolved) {
    if (!ref && !resolved) return "#";
    if (ref && ref.href) return ref.href;
    var ownFile = (currentLesson && currentLesson.file) || pageLessonFile();
    var file = (ref && ref.file) || (resolved && resolved.file);
    if (!file) return "#";
    if (ownFile) return relLessonHref(ownFile, file);
    return getLessonHref(file, true);
  }

  function renderLessonPager(data, currentLesson) {
    var lessonEl = document.querySelector(".lesson");
    if (!lessonEl || !currentLesson) return;

    var pagerEl = lessonEl.querySelector(".kit-pager");
    if (!pagerEl) {
      pagerEl = document.createElement("nav");
      pagerEl.className = "kit-pager";
      pagerEl.setAttribute("aria-label", "课时翻页导航");
      var footerEl = lessonEl.querySelector(".lesson-footer");
      if (footerEl) {
        lessonEl.insertBefore(pagerEl, footerEl);
      } else {
        lessonEl.appendChild(pagerEl);
      }
    }

    var isLessonPage = true;
    var homeUrl = currentLesson.home || (data && data.home) || "../index.html";

    var prevLesson = null;
    if (currentLesson.prev) {
      prevLesson = findLesson(data, currentLesson.prev) || currentLesson.prev;
    }

    var nextLesson = null;
    if (currentLesson.next) {
      nextLesson = findLesson(data, currentLesson.next) || currentLesson.next;
    }

    var html = [];
    html.push('<div class="kit-pager__grid">');

    // Prev Card
    if (prevLesson && prevLesson.file) {
      var prevHref = lessonLinkHref(currentLesson, currentLesson.prev, prevLesson);
      var prevNum = prevLesson.number ? ("第 " + prevLesson.number + " 课") : "上一课";
      var prevTitle = prevLesson.title || "上一课";
      html.push('  <a href="' + prevHref + '" class="kit-pager__card kit-pager__card--prev" rel="prev" data-nav-prev="">');
      html.push('    <span class="kit-pager__meta">');
      html.push('      <span class="kit-pager__arrow">←</span>');
      html.push('      <span class="kit-pager__label">上一课 · ' + prevNum + '</span>');
      html.push('    </span>');
      html.push('    <span class="kit-pager__title">' + prevTitle + '</span>');
      html.push('  </a>');
    } else {
      html.push('  <div class="kit-pager__card kit-pager__card--empty" aria-hidden="true"></div>');
    }

    // Next Card
    if (nextLesson && nextLesson.file) {
      var nextHref = lessonLinkHref(currentLesson, currentLesson.next, nextLesson);
      var nextNum = nextLesson.number ? ("第 " + nextLesson.number + " 课") : "下一课";
      var nextTitle = nextLesson.title || "下一课";
      html.push('  <a href="' + nextHref + '" class="kit-pager__card kit-pager__card--next" rel="next" data-nav-next="">');
      html.push('    <span class="kit-pager__meta">');
      html.push('      <span class="kit-pager__label">下一课 · ' + nextNum + '</span>');
      html.push('      <span class="kit-pager__arrow">→</span>');
      html.push('    </span>');
      html.push('    <span class="kit-pager__title">' + nextTitle + '</span>');
      html.push('  </a>');
    } else {
      // Last lesson -> link to course index
      html.push('  <a href="' + homeUrl + '" class="kit-pager__card kit-pager__card--finish" data-nav-home="">');
      html.push('    <span class="kit-pager__meta">');
      html.push('      <span class="kit-pager__label">本单元完结 · 返回大纲</span>');
      html.push('      <span class="kit-pager__arrow">⊞</span>');
      html.push('    </span>');
      html.push('    <span class="kit-pager__title">课程首页与后续规划</span>');
      html.push('  </a>');
    }

    html.push('</div>');

    // Central Home Action
    html.push('<div class="kit-pager__bottom">');
    html.push('  <a href="' + homeUrl + '" class="kit-pager__home-btn" data-nav-home="">');
    html.push('    <span class="kit-pager__home-icon">⊞</span>');
    html.push('    <span>课程首页</span>');
    html.push('  </a>');
    html.push('</div>');

    pagerEl.innerHTML = html.join("\n");
  }

  function initNav() {
    if (typeof document === "undefined") return;

    var navEls = Array.prototype.slice.call(document.querySelectorAll("nav.kit-nav, nav.course-nav, [data-kit-nav]"));
    var lessonEl = document.querySelector(".lesson");
    var currentLessonId = lessonEl ? lessonEl.dataset.lessonId : null;

    var navData = (kit.config && kit.config.navigation) || kit.__NAV_DATA__ || root.__NAV_DATA__;

    function applyNav(data) {
      if (!data || !Array.isArray(data.lessons)) return;
      var currentLesson = null;
      var lessons = data.lessons;
      var pageFile = pageLessonFile();
      var i, it;

      // 1. exact lessons/-relative path — unique even when chapters share numbers
      for (i = 0; i < lessons.length; i += 1) {
        if (pageFile && lessons[i].file === pageFile) { currentLesson = lessons[i]; break; }
      }
      // 2. file name only, when it is not ambiguous across chapters
      if (!currentLesson && pageFile) {
        var base = pageFile.split("/").pop();
        var matches = [];
        for (i = 0; i < lessons.length; i += 1) {
          it = lessons[i];
          if (it.file && it.file.split("/").pop() === base) matches.push(it);
        }
        if (matches.length === 1) currentLesson = matches[0];
      }
      // 3. data-lesson-id plus chapter taken from the URL
      if (!currentLesson && currentLessonId != null) {
        var chapterFromPath = pageFile.indexOf("/") === -1 ? "" : pageFile.split("/")[0];
        for (i = 0; i < lessons.length; i += 1) {
          it = lessons[i];
          var sameNumber = it.number && (it.number === currentLessonId || String(Number(it.number)) === String(Number(currentLessonId)));
          if (!sameNumber) continue;
          if (chapterFromPath && it.chapter === chapterFromPath) { currentLesson = it; break; }
          if (!it.chapter) currentLesson = it;
        }
      }

      // Render Left Global Course Navigator (The Navigator)
      renderSidebar(data, currentLessonId, currentLesson);

      // Render Lesson End Pager
      renderLessonPager(data, currentLesson);

      navEls.forEach(function (nav) {
        if (nav.closest(".course-header, .kit-header")) {
          // Do not inject navigation into headers; moved to lesson footer
          return;
        }
        if (currentLesson) {
          var homeLink = nav.querySelector('[data-nav-home], a[href*="index.html"]');
          var prevLink = nav.querySelector('[data-nav-prev], a[rel="prev"]');
          var nextLink = nav.querySelector('[data-nav-next], a[rel="next"]');

          if (!prevLink && currentLesson.prev) {
            var aPrev = document.createElement("a");
            aPrev.href = lessonLinkHref(currentLesson, currentLesson.prev);
            aPrev.rel = "prev";
            aPrev.dataset.navPrev = "";
            aPrev.className = "nav-prev";
            aPrev.textContent = "← 上一课";
            if (homeLink) nav.insertBefore(aPrev, homeLink);
            else nav.insertBefore(aPrev, nav.firstChild);
          }

          if (!nextLink && currentLesson.next) {
            var aNext = document.createElement("a");
            aNext.href = lessonLinkHref(currentLesson, currentLesson.next);
            aNext.rel = "next";
            aNext.dataset.navNext = "";
            aNext.className = "nav-next";
            aNext.textContent = "下一课 →";
            if (homeLink && homeLink.nextSibling) nav.insertBefore(aNext, homeLink.nextSibling);
            else nav.appendChild(aNext);
          }
        }
      });
    }

    if (navData && Array.isArray(navData.lessons)) {
      applyNav(navData);
    } else if (typeof fetch === "function") {
      var isLesson = !!document.querySelector(".lesson, [data-lesson-id]");
      // nav.json sits at <course>/assets/course/nav.json. Resolving it from the
      // kit.js tag keeps the path correct for chaptered lessons, which sit one
      // directory deeper than the flat layout the literal "../" assumed.
      var navUrl = navJsonUrl(isLesson ? "../assets/course/nav.json" : "assets/course/nav.json");
      fetch(navUrl)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && Array.isArray(data.lessons)) {
            kit.__NAV_DATA__ = data;
            applyNav(data);
          }
        })
        .catch(function () {
          // nav.json is the single navigation source (regenerated by kit.py sync);
          // without it the sidebar shows the static TOC fallback only.
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[kit] nav.json load failed — sidebar navigation unavailable. Re-run kit.py sync or open via kit.py serve.");
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
