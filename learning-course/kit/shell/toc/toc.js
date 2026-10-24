(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var headings = [];
  var activeHeadingId = null;
  var desktopScrollBox = null;
  var allLinkNodes = [];

  function getHeadings() {
    var scope = document.querySelector(".kit-main, .lesson") || document.body;
    var raw = Array.prototype.slice.call(scope.querySelectorAll("h2, h3, [data-toc-label]"));
    var result = [];

    raw.forEach(function (el) {
      if (el.hasAttribute("data-toc-skip")) return;
      if (!el.id) {
        el.id = kit.util && kit.util.slugify ? kit.util.slugify(el.textContent) : el.textContent.trim().toLowerCase().replace(/\s+/g, "-");
      }
      var label = el.dataset.tocLabel;
      if (!label) {
        var clone = el.cloneNode(true);
        var mathml = clone.querySelectorAll(".katex-mathml");
        for (var m = 0; m < mathml.length; m++) {
          mathml[m].remove();
        }
        label = clone.textContent.trim();
      }
      var isH3 = el.tagName && el.tagName.toLowerCase() === "h3";
      result.push({
        id: el.id,
        label: label,
        isH3: isH3,
        element: el
      });
    });
    return result;
  }

  function buildHeadingTree(headingsList) {
    var tree = [];
    var currentH2 = null;

    headingsList.forEach(function (h) {
      if (!h.isH3) {
        currentH2 = {
          id: h.id,
          label: h.label,
          element: h.element,
          children: []
        };
        tree.push(currentH2);
      } else {
        if (currentH2) {
          currentH2.children.push(h);
        } else {
          currentH2 = {
            id: h.id,
            label: h.label,
            element: h.element,
            children: []
          };
          tree.push(currentH2);
        }
      }
    });

    return tree;
  }

  function setExpanded(li, expand) {
    if (!li) return;
    if (expand) {
      li.classList.remove("is-collapsed");
      li.classList.add("is-expanded");
      var btn = li.querySelector(".kit-toc__toggle, .toc-toggle");
      if (btn) {
        btn.setAttribute("aria-expanded", "true");
        btn.setAttribute("title", "收起子目录");
        btn.setAttribute("aria-label", "收起子目录");
      }
    } else {
      li.classList.remove("is-expanded");
      li.classList.add("is-collapsed");
      var btn = li.querySelector(".kit-toc__toggle, .toc-toggle");
      if (btn) {
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("title", "展开子目录");
        btn.setAttribute("aria-label", "展开子目录");
      }
    }
  }

  function renderList(targetUl, closeCallback) {
    targetUl.innerHTML = "";
    var tree = buildHeadingTree(headings);

    tree.forEach(function (node) {
      var li = document.createElement("li");
      var hasChildren = node.children && node.children.length > 0;
      // All H3 subsections are collapsed by default
      li.className = "kit-toc__item toc-item is-h2" + (hasChildren ? " has-children is-collapsed" : " no-children");
      li.dataset.sectionId = node.id;

      var row = document.createElement("div");
      row.className = "kit-toc__row toc-row" + (hasChildren ? " has-children" : " no-children");

      if (hasChildren) {
        var toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "kit-toc__toggle toc-toggle";
        toggleBtn.setAttribute("aria-label", "展开子目录");
        toggleBtn.setAttribute("title", "展开子目录");
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.innerHTML = '<svg class="kit-toc__chevron" viewBox="0 0 16 16" width="9" height="9" aria-hidden="true"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

        toggleBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          e.preventDefault();
          var isCollapsed = li.classList.contains("is-collapsed");
          setExpanded(li, isCollapsed);
        });

        row.appendChild(toggleBtn);
      } else {
        var spacer = document.createElement("span");
        spacer.className = "kit-toc__spacer";
        spacer.setAttribute("aria-hidden", "true");
        row.appendChild(spacer);
      }

      var a = document.createElement("a");
      a.className = "kit-toc__link toc-link is-h2-link";
      a.href = "#" + node.id;
      a.textContent = node.label;
      a.dataset.targetId = node.id;

      a.addEventListener("click", function (e) {
        e.preventDefault();
        var target = document.getElementById(node.id);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          if (history.pushState) history.pushState(null, "", "#" + node.id);
        }
        if (closeCallback) closeCallback();
      });

      row.appendChild(a);
      li.appendChild(row);
      allLinkNodes.push(a);

      if (hasChildren) {
        var subUl = document.createElement("ul");
        subUl.className = "kit-toc__sublist toc-sublist";

        node.children.forEach(function (child) {
          var subLi = document.createElement("li");
          subLi.className = "kit-toc__item toc-item is-h3";
          subLi.dataset.sectionId = child.id;

          var subA = document.createElement("a");
          subA.className = "kit-toc__link toc-link is-h3-link";
          subA.href = "#" + child.id;
          subA.textContent = child.label;
          subA.dataset.targetId = child.id;
          subA.dataset.parentId = node.id;

          subA.addEventListener("click", function (e) {
            e.preventDefault();
            var target = document.getElementById(child.id);
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
              if (history.pushState) history.pushState(null, "", "#" + child.id);
            }
            if (closeCallback) closeCallback();
          });

          subLi.appendChild(subA);
          subUl.appendChild(subLi);
          allLinkNodes.push(subA);
        });

        li.appendChild(subUl);
      }

      targetUl.appendChild(li);
    });
  }

  function updateActiveLink(id) {
    if (activeHeadingId === id) return;
    activeHeadingId = id;

    allLinkNodes.forEach(function (a) {
      if (a.dataset.targetId === id) {
        a.setAttribute("aria-current", "location");
        a.classList.add("is-active");

        var visibleTarget = a;
        if (a.dataset.parentId) {
          var parentLi = a.closest(".kit-toc__item.has-children, .toc-item.has-children");
          if (parentLi && parentLi.classList.contains("is-collapsed")) {
            visibleTarget = parentLi;
          }
        }

        // Keep active item in view inside the TOC container without whole-page scroll
        if (desktopScrollBox && desktopScrollBox.contains(visibleTarget)) {
          var containerTop = desktopScrollBox.scrollTop;
          var containerHeight = desktopScrollBox.clientHeight;
          var itemTop = visibleTarget.offsetTop;
          var itemHeight = visibleTarget.offsetHeight;

          if (itemTop < containerTop) {
            desktopScrollBox.scrollTop = itemTop - 10;
          } else if (itemTop + itemHeight > containerTop + containerHeight) {
            desktopScrollBox.scrollTop = itemTop + itemHeight - containerHeight + 10;
          }
        }
      } else {
        a.removeAttribute("aria-current");
        a.classList.remove("is-active");
      }
    });

    var allParentLis = document.querySelectorAll(".kit-toc__item.has-children, .toc-item.has-children");
    for (var p = 0; p < allParentLis.length; p++) {
      var pLi = allParentLis[p];
      var hasActiveChild = !!pLi.querySelector(".kit-toc__sublist .is-active, .toc-sublist .is-active");
      if (hasActiveChild) {
        pLi.classList.add("has-active-child");
      } else {
        pLi.classList.remove("has-active-child");
      }
    }

    var mobileBar = document.querySelector(".kit-toc-mobile-bar span");
    if (mobileBar) {
      var match = headings.find(function (h) { return h.id === id; });
      if (match) mobileBar.textContent = match.label;
    }
  }

  function handleScroll() {
    var offset = 100;
    var matchedId = null;

    for (var i = 0; i < headings.length; i++) {
      var rect = headings[i].element.getBoundingClientRect();
      if (rect.top <= offset) {
        matchedId = headings[i].id;
      } else {
        break;
      }
    }

    if (!matchedId && headings.length) {
      matchedId = headings[0].id;
    }

    if (matchedId) {
      updateActiveLink(matchedId);
    }
  }

  var onScrollThrottled = kit.util ? kit.util.throttleRAF(handleScroll) : handleScroll;

  function initToc() {
    if (typeof document === "undefined") return;
    headings = getHeadings();
    if (!headings.length) {
      if (kit.ready && kit.ready.markReady) kit.ready.markReady("shell.toc");
      return;
    }

    allLinkNodes = [];

    // 1. Desktop sidebar TOC
    var desktopToc = document.querySelector(".kit-toc, .toc, [data-auto-toc]");
    if (desktopToc) {
      desktopToc.innerHTML = "";

      var header = document.createElement("div");
      header.className = "kit-toc__header toc-header";
      var title = document.createElement("p");
      title.className = "kit-toc__title toc-title";
      title.textContent = "本课目录";
      header.appendChild(title);
      desktopToc.appendChild(header);

      desktopScrollBox = document.createElement("div");
      desktopScrollBox.className = "kit-toc__scroll toc-scroll";
      var ul = document.createElement("ul");
      ul.className = "kit-toc__list toc-list";

      renderList(ul);
      desktopScrollBox.appendChild(ul);
      desktopToc.appendChild(desktopScrollBox);
    }

    // 2. Tablet floating popover button
    var popoverBtn = document.createElement("button");
    popoverBtn.type = "button";
    popoverBtn.className = "kit-toc-btn";
    popoverBtn.textContent = "目录";
    document.body.appendChild(popoverBtn);

    var popover = document.createElement("div");
    popover.className = "kit-toc-popover";
    var popoverUl = document.createElement("ul");
    popoverUl.className = "kit-toc__list toc-list";
    renderList(popoverUl, function () { popover.classList.remove("is-open"); });
    popover.appendChild(popoverUl);
    document.body.appendChild(popover);

    popoverBtn.addEventListener("click", function () {
      popover.classList.toggle("is-open");
    });

    // 3. Mobile bar and bottom drawer
    var mobileBar = document.createElement("div");
    mobileBar.className = "kit-toc-mobile-bar";
    mobileBar.innerHTML = "<span>目录</span><small>▼</small>";
    var page = document.querySelector(".kit-page, .course-shell");
    if (page) page.insertBefore(mobileBar, page.firstChild);

    var backdrop = document.createElement("div");
    backdrop.className = "kit-backdrop";
    document.body.appendChild(backdrop);

    var drawer = document.createElement("div");
    drawer.className = "kit-drawer";
    var drawerUl = document.createElement("ul");
    drawerUl.className = "kit-toc__list toc-list";
    renderList(drawerUl, function () {
      drawer.classList.remove("is-open");
      backdrop.classList.remove("is-open");
    });
    drawer.appendChild(drawerUl);
    document.body.appendChild(drawer);

    function toggleMobileDrawer() {
      var isOpen = drawer.classList.toggle("is-open");
      backdrop.classList.toggle("is-open", isOpen);
    }

    mobileBar.addEventListener("click", toggleMobileDrawer);
    backdrop.addEventListener("click", function () {
      drawer.classList.remove("is-open");
      backdrop.classList.remove("is-open");
    });

    // Keyboard handling
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        popover.classList.remove("is-open");
        drawer.classList.remove("is-open");
        backdrop.classList.remove("is-open");
      }
    });

    window.addEventListener("scroll", onScrollThrottled, { passive: true });
    handleScroll();

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("shell.toc");
    }
  }

  kit.toc = {
    init: initToc
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initToc);
    else initToc();
  }
})(typeof window !== "undefined" ? window : globalThis);
