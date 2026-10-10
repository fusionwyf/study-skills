async (page) => {
  const baseURL = new URL(page.url()).origin;
  const results = [];
  const browser = page.context().browser();
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  try {
    const offline = await context.newPage();
    for (const name of [
      "0001-math",
      "0002-probability",
      "0003-algorithm",
      "0004-history",
      "0005-design",
      "0006-language",
    ]) {
      await offline.goto(baseURL + "/lessons/" + name + ".html");
      const text = await offline.locator("main").innerText();
      if (text.length < 100) throw new Error("blank no-script " + name);
      const fallbacks = offline.locator(
        "[data-viz-fallback],[data-media-fallback]",
      );
      for (let i = 0; i < (await fallbacks.count()); i++)
        if (!(await fallbacks.nth(i).isVisible()))
          throw new Error("hidden no-script fallback " + name);
      await offline.emulateMedia({ media: "print" });
      await offline.screenshot({
        path: "output/playwright/" + name + "-print.png",
        fullPage: true,
      });
      await offline.emulateMedia({ media: "screen" });
      results.push({ name, noScript: true, print: true });
    }
  } finally {
    await context.close();
  }
  await page.route("**/vendor/**", (route) => route.abort());
  await page.goto(baseURL + "/lessons/0002-probability.html");
  await page.waitForFunction(
    () => window.__COURSE_VISUALIZATIONS_READY__ === true,
  );
  if ((await page.locator("#probability-chart-host svg").count()) !== 1)
    throw new Error("missing vendor SVG fallback");
  await page.locator("#p-value").focus();
  await page.keyboard.press("Home");
  await page.waitForFunction(
    () =>
      JSON.parse(
        document.getElementById("probability-chart").dataset.visualState,
      ).traces[0].y[0] === 0,
  );
  await page.goto(baseURL + "/lessons/0001-math.html");
  await page.waitForFunction(
    () => window.__COURSE_VISUALIZATIONS_READY__ === true,
  );
  if ((await page.locator("#linear-transform-host table").count()) !== 1)
    throw new Error("missing vendor spatial fallback");
  await page.locator("#linear-transform-y").fill("1");
  await page.locator("#linear-transform-y").blur();
  if (
    JSON.parse(
      await page.locator("#linear-transform").getAttribute("data-visual-state"),
    ).image[0] !== 2
  )
    throw new Error("spatial fallback numeric edit");
  await page.unroute("**/vendor/**");
  await page.route("**/cdn.jsdelivr.net/**", route => route.abort());
  await page.goto(baseURL + "/lessons/0003-algorithm.html");
  await page.waitForFunction(() => window.__COURSE_CODE_HIGHLIGHT_READY__ === false);
  if (!(await page.locator('.code-block code').textContent()).includes('for i in range')) throw new Error('CDN failure lost code source');
  await page.goto(baseURL + "/lessons/0001-math.html");
  await page.waitForFunction(() => window.__COURSE_MATH_READY__ === false);
  if (await page.locator('.katex').count() || !(await page.locator('.formula').textContent()).includes('\\frac')) throw new Error('CDN failure lost formula source');
  await page.unroute("**/cdn.jsdelivr.net/**");
  return { lessons: results, missingVendor: { chart: true, spatial: true }, missingCDN: {codeSource: true, mathSource: true} };
}
