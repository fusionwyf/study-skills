(function (root) {
  "use strict";

  var kit = root.CourseKit = root.CourseKit || {};
  root.kit = root.kit || kit;

  function createBlock(options) {
    options = options || {};
    var kind = options.kind || "generic";
    var labelText = options.label || "";
    var titleText = options.title || "";

    var block = document.createElement("figure");
    block.className = "kit-block";
    block.dataset.kind = kind;
    block.dataset.kitState = "pending";

    var label = document.createElement("div");
    label.className = "kit-block__label";
    label.textContent = labelText;

    var actions = document.createElement("div");
    actions.className = "kit-block__actions";

    var body = document.createElement("div");
    body.className = "kit-block__body";

    if (titleText) {
      block.classList.add("has-header");
      var header = document.createElement("div");
      header.className = "kit-block__header";

      var title = document.createElement("span");
      title.className = "kit-block__title";
      title.textContent = titleText;

      header.appendChild(title);
      header.appendChild(label);
      header.appendChild(actions);
      block.appendChild(header);
    } else {
      block.appendChild(label);
      block.appendChild(actions);
    }

    block.appendChild(body);

    function addAction(text, onClick, ariaLabel) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kit-block__btn";
      btn.textContent = text;
      if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
      btn.addEventListener("click", onClick);
      actions.appendChild(btn);
      return btn;
    }

    return {
      root: block,
      label: label,
      actions: actions,
      body: body,
      addAction: addAction
    };
  }

  kit.block = {
    create: createBlock
  };

  if (kit.ready && kit.ready.markReady) {
    kit.ready.markReady("content._block");
  }
})(typeof window !== "undefined" ? window : globalThis);
