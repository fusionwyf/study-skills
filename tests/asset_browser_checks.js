async (page) => {
  const baseURL = new URL(page.url()).origin;
  const failures = [],
    results = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const lessons = [
    "0001-math",
    "0002-probability",
    "0003-algorithm",
    "0004-history",
    "0005-design",
    "0006-language",
  ];
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  for (const name of lessons) {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto(baseURL + "/lessons/" + name + ".html");
    await page.waitForFunction(
      () =>
        window.__COURSE_READY__ === true &&
        window.__COURSE_VISUALIZATIONS_READY__ === true,
    );
    const ready = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          "[data-visualization],[data-media],[data-learnkit]",
        ),
      ).map((n) => ({
        id: n.id,
        ready: n.dataset.vizReady || n.dataset.mediaReady || n.dataset.lkReady,
        status: n.querySelector("[data-viz-status]")?.textContent,
      })),
    );
    for (const r of ready)
      if (r.ready !== "true")
        throw new Error(name + " initialization " + JSON.stringify(r));
    if (name === "0001-math") {
      await page.waitForFunction(() => window.__COURSE_MATH_READY__ === true);
      if (await page.locator('.formula .katex').count() !== 1 || await page.locator('.katex-error').count()) throw new Error('KaTeX typesetting failed');
      await page.locator("#derivative-a").fill("6");
      await page
        .locator('[data-question-id="derivative"] [data-answer-check]')
        .click();
      const q = await page.evaluate(
        () =>
          document.querySelector(".lesson").__evidenceStore.getState().questions
            .derivative,
      );
      if (q.verdict !== "correct" || q.rawAnswer !== "6")
        throw new Error("numeric evidence");
      await page.locator("#linear-transform-y").fill("1");
      await page.locator("#linear-transform-y").blur();
      const state = await page
        .locator("#linear-transform")
        .getAttribute("data-visual-state");
      if (JSON.parse(state).image[0] !== 2)
        throw new Error("spatial numeric update " + state);
    }
    if (name === "0002-probability") {
      await page.locator("#p-value").focus();
      await page.keyboard.press("End");
      await page.waitForFunction(
        () =>
          JSON.parse(
            document.getElementById("probability-chart").dataset.visualState,
          ).traces[0].y[0] === 1,
      );
      await page.waitForFunction(
        () =>
          document.getElementById("probability-chart-host").data[0].y[0] === 1,
      );
      const count = await page.locator(".plotly").count();
      if (count !== 1) throw new Error("local vendor chart missing");
    }
    if (name === "0003-algorithm") {
      await page.waitForFunction(() => window.__COURSE_CODE_HIGHLIGHT_READY__ === true);
      if (await page.locator('.code-block .hljs-keyword').count() < 1) throw new Error('highlight.js token rendering missing');
      await page.waitForFunction(() => {
        const link = document.getElementById('course-code-theme');
        const token = document.querySelector('.code-block .hljs-keyword');
        return link?.sheet && token && getComputedStyle(token).color === 'rgb(215, 58, 73)';
      });
      if (!(await page.locator('#course-code-theme').getAttribute('href')).startsWith('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.12.0/')) throw new Error('official theme must use CDN');
      const colored = await page.locator('.code-block .hljs-keyword').first().evaluate(n=>getComputedStyle(n).color!==getComputedStyle(n.closest('code')).color);
      if (!colored) throw new Error('official CDN theme has not colored tokens');
      const original = await page.locator('.code-block code').textContent();
      await page.locator('#course-theme-select').selectOption('ink');
      await page.waitForFunction(() => document.getElementById('course-code-theme').href.endsWith('github-dark.min.css'));
      await page.waitForFunction(() => {
        const token = document.querySelector('.code-block .hljs-keyword');
        return document.getElementById('course-code-theme')?.sheet && token && getComputedStyle(token).color === 'rgb(255, 123, 114)';
      });
      if (await page.locator('html').getAttribute('data-theme') !== 'ink') throw new Error('course theme switch failed');
      const bg = await page.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor);
      if (bg !== 'rgb(16, 24, 39)') throw new Error('custom theme CSS not applied: '+bg);
      if (await page.locator('.code-block code').textContent() !== original) throw new Error('theme changed source text');
      await page.locator('#course-theme-select').selectOption('course');
      await page.waitForFunction(() => {
        const token = document.querySelector('.code-block .hljs-keyword');
        return document.getElementById('course-code-theme')?.sheet && token && getComputedStyle(token).color === 'rgb(215, 58, 73)';
      });
      await page.locator("[data-viz-next]").click();
      if (
        !(await page
          .locator("#sort-steps [data-viz-status]")
          .textContent()
          .then((t) => t.includes("2/3")))
      )
        throw new Error("step controls");
      await page.locator('#sort-flow svg [role="button"]').first().focus();
      await page.keyboard.press("Enter");
      if (
        JSON.parse(
          await page.locator("#sort-flow").getAttribute("data-visual-state"),
        ).selected !== 0
      )
        throw new Error("graph keyboard");
    }
    if (name === "0004-history")
      if ((await page.locator(".viz-date").count()) !== 3)
        throw new Error("timeline date missing");
    if (name === "0005-design") {
      await page.waitForFunction(() => {
        const i = document.querySelector("[data-media-frame] img");
        return (
          i.complete &&
          i.naturalWidth > 0 &&
          i.clientWidth > 100 &&
          i.clientHeight > 50
        );
      });
      await page.locator(".media-hotspot").first().focus();
      await page.keyboard.press("Enter");
      await page.locator("#design-notes").fill("入口与庭院之间的路线明确。");
      const raw = await page.evaluate(
        () =>
          document.querySelector(".lesson").__evidenceStore.getState()
            .questions["design-observation"].rawAnswer,
      );
      if (raw !== "入口与庭院之间的路线明确。")
        throw new Error("annotation evidence");
    }
    if (name === "0006-language") {
      await page.locator("audio").evaluate((a) => a.play());
      await page.waitForFunction(
        () => document.querySelector("audio").currentTime > 0,
      );
      const media = await page
        .locator("audio")
        .evaluate((a) => ({ duration: a.duration, error: a.error?.message }));
      if (!Number.isFinite(media.duration) || media.error)
        throw new Error("audio metadata " + JSON.stringify(media));
      await page.locator("#listen-a").fill("three");
      await page.locator("[data-answer-check]").click();
      if (
        (await page.evaluate(
          () =>
            document.querySelector(".lesson").__evidenceStore.getState()
              .questions["listening-answer"].verdict,
        )) !== "correct"
      )
        throw new Error("fill answer");
      await page.locator("[data-media-transcript] summary").click();
      await page.waitForFunction(
        () =>
          document.querySelector(".lesson").__evidenceStore.getState()
            .questions["listening-answer"].answerViewed === true,
      );
    }
    await page.screenshot({
      path: "output/playwright/" + name + "-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    if (overflow) throw new Error("mobile overflow " + name);
    await page.screenshot({
      path: "output/playwright/" + name + "-mobile.png",
      fullPage: true,
    });
    await page.emulateMedia({ media: "print" });
    const hiddenFallback = await page
      .locator("[data-viz-fallback],[data-media-fallback]")
      .evaluateAll((ns) =>
        ns.some((n) => getComputedStyle(n).display === "none"),
      );
    if (hiddenFallback) throw new Error("print fallback " + name);
    await page.emulateMedia({ media: "screen" });
    results.push({
      name,
      ready,
      desktop: true,
      mobile: true,
      printFallback: true,
    });
  }
  if (failures.length)
    throw new Error("page errors " + JSON.stringify(failures));
  return results;
}
