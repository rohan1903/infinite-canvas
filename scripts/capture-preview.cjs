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

  // Idle intro frames.
  for (let i = 0; i < 8; i++) {
    await snap();
    await page.waitForTimeout(100);
  }

  // Draw a smooth stroke.
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

  // Pan with space + drag.
  await page.keyboard.down("Space");
  await page.mouse.move(980, 380);
  await page.mouse.down();
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    await page.mouse.move(980 - 260 * t, 380 - 90 * t);
    await snap();
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.keyboard.up("Space");

  // Zoom in and out a little.
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -220);
    await snap();
    await page.waitForTimeout(90);
  }
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 220);
    await snap();
    await page.waitForTimeout(90);
  }

  // Outro hold.
  for (let i = 0; i < 10; i++) {
    await snap();
    await page.waitForTimeout(100);
  }

  await browser.close();
  console.log(`Captured ${frame} frames in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
