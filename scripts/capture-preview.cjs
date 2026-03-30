const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

async function main() {
  const outDir = path.join(process.cwd(), "docs", "frames");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto("https://infinite-canvas-wine.vercel.app", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1500);

  let frame = 0;
  const snap = async () => {
    const file = path.join(outDir, `frame-${String(frame).padStart(3, "0")}.png`);
    await page.screenshot({ path: file });
    frame += 1;
  };
  const hold = async (ms = 120, count = 1) => {
    for (let i = 0; i < count; i++) {
      await snap();
      await page.waitForTimeout(ms);
    }
  };
  const drag = async (x1, y1, x2, y2, steps = 16, wait = 35) => {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      await page.mouse.move(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
      await snap();
      await page.waitForTimeout(wait);
    }
    await page.mouse.up();
  };

  await hold(120, 8);

  await page.locator('[data-tool="freehand"]').click();
  await page.mouse.move(450, 300);
  await page.mouse.down();
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = 450 + 420 * t;
    const y = 300 + Math.sin(t * Math.PI * 1.5) * 70;
    await page.mouse.move(x, y);
    await snap();
    await page.waitForTimeout(35);
  }
  await page.mouse.up();
  await hold(80, 3);

  await page.locator('[data-tool="rectangle"]').click();
  await drag(640, 200, 900, 390, 18, 30);
  await hold(80, 3);

  await page.locator('[data-tool="arrow"]').click();
  await drag(320, 520, 600, 380, 12, 35);
  await hold(80, 3);

  await page.locator('[data-tool="text"]').click();
  await page.mouse.click(710, 440);
  const textEditor = page.locator("#text-editor");
  await textEditor.fill("Infinite Canvas Demo");
  await page.keyboard.press("Control+Enter");
  await hold(120, 4);

  await page.locator("#color-menu-button").click();
  await page.waitForTimeout(120);
  await page.locator("#foreground-input").evaluate((el) => {
    el.value = "#0ea5e9";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await hold(90, 2);
  await page.locator("#background-input").evaluate((el) => {
    el.value = "#f8fafc";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await hold(90, 2);
  await page.locator("#fill-enabled").check();
  await page.locator("#fill-input").evaluate((el) => {
    el.value = "#bae6fd";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await hold(90, 2);
  await page.keyboard.press("Escape");
  await hold(90, 2);

  await page.locator('[data-tool="ellipse"]').click();
  await drag(980, 470, 1210, 610, 16, 30);
  await hold(90, 3);

  await page.locator("#stroke-width").fill("7");
  await hold(90, 2);
  await page.locator('[data-tool="line"]').click();
  await drag(240, 210, 470, 210, 10, 30);
  await hold(90, 3);

  await page.locator('[data-tool="hand"]').click();
  await drag(960, 360, 720, 290, 14, 35);
  await hold(90, 2);

  await page.locator("#fit-content-button").click();
  await hold(120, 3);
  await page.locator("#focus-content-button").click();
  await hold(120, 3);
  await page.locator("#grid-toggle-button").click();
  await hold(120, 3);
  await page.locator("#grid-toggle-button").click();
  await hold(90, 2);

  await page.locator('[data-tool="select"]').click();
  await page.mouse.click(860, 300);
  await hold(90, 2);
  await page.locator("#undo-button").click();
  await hold(120, 3);
  await page.locator("#redo-button").click();
  await hold(120, 3);
  await page.locator("#delete-button").click();
  await hold(120, 3);

  await page.locator("#menu-button").click();
  await hold(150, 4);
  await page.locator("#export-png-button").hover();
  await hold(120, 2);
  await page.locator("#export-svg-button").hover();
  await hold(120, 2);
  await page.locator("#copy-png-button").hover();
  await hold(120, 2);
  await page.keyboard.press("Escape");
  await hold(120, 6);

  await browser.close();
  console.log(`Captured ${frame} frames in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
