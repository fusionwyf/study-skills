(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  var PRESETS = {
    fadeIn: { name: "kit-fade-in", duration: "0.6s", easing: "ease-out" },
    slideUp: { name: "kit-slide-up", duration: "0.6s", easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    bounce: { name: "kit-bounce", duration: "0.8s", easing: "ease-in-out" }
  };

  var observerOptions = {
    root: null,
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.1
  };

  var observer = null;

  function parseConfig(el) {
    var preset = el.dataset.animate || "fadeIn";
    var duration = el.dataset.animateDuration;
    var delay = el.dataset.animateDelay || "0s";
    var easing = el.dataset.animateEasing;

    if (PRESETS[preset]) {
      var p = PRESETS[preset];
      return {
        name: p.name,
        duration: duration || p.duration,
        easing: easing || p.easing,
        delay: delay
      };
    }

    return {
      name: preset,
      duration: duration || "0.6s",
      easing: easing || "ease-out",
      delay: delay
    };
  }

  function animateElement(el) {
    if (el.classList.contains("is-animated")) return;

    var cfg = parseConfig(el);
    el.style.setProperty("--anim-name", cfg.name);
    el.style.setProperty("--anim-duration", cfg.duration);
    el.style.setProperty("--anim-easing", cfg.easing);
    el.style.setProperty("--anim-delay", cfg.delay);
    el.classList.add("is-animated");

    el.addEventListener("animationend", function onEnd() {
      el.removeEventListener("animationend", onEnd);
      if (kit.emit) {
        kit.emit("kit:animation:complete", { element: el, id: el.id });
      }
    }, { once: true });
  }

  function observeCallback(entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateElement(entry.target);
        if (observer) observer.unobserve(entry.target);
      }
    });
  }

  function enhance() {
    if (typeof document === "undefined") return;

    var elements = document.querySelectorAll("[data-animate]");
    if (!elements.length) {
      if (kit.ready && kit.ready.markReady) {
        kit.ready.markReady("content.animation");
      }
      return;
    }

    if ("IntersectionObserver" in root) {
      observer = new IntersectionObserver(observeCallback, observerOptions);
      Array.prototype.forEach.call(elements, function (el) {
        if (el.dataset.animateTrigger === "immediate") {
          animateElement(el);
        } else {
          observer.observe(el);
        }
      });
    } else {
      Array.prototype.forEach.call(elements, animateElement);
    }

    if (kit.ready && kit.ready.markReady) {
      kit.ready.markReady("content.animation");
    }
  }

  kit.animation = {
    animate: animateElement,
    presets: PRESETS,
    init: enhance
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", enhance);
    } else {
      enhance();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
