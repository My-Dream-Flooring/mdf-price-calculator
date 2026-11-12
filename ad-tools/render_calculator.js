/*
 * Render the live "get my price" calculator as a phone screenshot for ads.
 *
 *   node ad-tools/render_calculator.js [--height 884] [--out ad-tools/out/calculator-screen.png] [--url <page>] [--no-local]
 *
 * - Phone viewport 390px wide (height = the ad's phone screen aspect; make_ad.py
 *   prints the right value), deviceScaleFactor 3.
 * - Loads the live page. The calculator's own files (JS, CSS, textures, three.js)
 *   are served from this repo by default, because they are the same files GitHub
 *   Pages publishes from main; pass --no-local to fetch them from GitHub Pages.
 * - Fills in Carpet, Living room, Medium, Westminster, Weekly, then scrolls so the
 *   3D room, flooring picks, size boxes, Westminster card and the whole price bar
 *   are on screen. Exits with an error if they can't all fit.
 * Needs Playwright (require('playwright')).
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const HEIGHT = parseInt(arg("--height", "884"), 10);
const OUT = arg("--out", path.join(__dirname, "out", "calculator-screen.png"));
const PAGE_URL = arg("--url", "https://mydreamflooring.co.uk/how-many-rooms-can-i-afford/");
const LOCAL = !args.includes("--no-local");
const REPO = path.join(__dirname, "..");

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: HEIGHT }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  if (LOCAL) {
    await page.route("https://my-dream-flooring.github.io/mdf-price-calculator/**", (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/mdf-price-calculator\//, ""));
      const file = path.join(REPO, rel);
      if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
      const types = { ".js": "application/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png" };
      route.fulfill({ status: 200, path: file, contentType: types[path.extname(file)] || "application/octet-stream", headers: { "Access-Control-Allow-Origin": "*" } });
    });
  }

  await page.goto(PAGE_URL, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("#mdf-price-calculator .mdfc-canvas", { timeout: 30000 });

  // Fill in the calculator
  await page.tap("#mdfc-prod-carpet");
  await page.tap('[data-type="Living room"]');
  await page.tap("#mdfc-size-medium");
  await page.tap("label[for=mdfc-range-westminster]");
  if (!(await page.isChecked("#mdfc-pay-weekly"))) await page.tap("label[for=mdfc-pay-weekly]");
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelector(".mdfc-stage-loading").hidden, null, { timeout: 30000 });

  // Scroll: room preview near the top, everything down to the Westminster card above the price bar
  const box = await page.evaluate(() => {
    const y = window.scrollY, q = (s) => document.querySelector(s).getBoundingClientRect();
    return { top: q(".mdfc-stage").top + y, bottom: q(".mdfc-range.is-on").bottom + y, bar: q(".mdfc-bar").height, vh: innerHeight };
  });
  const free = box.vh - box.bar, need = box.bottom - box.top;
  if (need > free - 8) throw new Error(`Needs ${Math.round(need)}px above the price bar but only ${Math.round(free)}px is free; use a taller --height`);
  // Room preview 8px from the top, so the text above it is fully off screen (no half-cut line)
  await page.evaluate((t) => window.scrollTo(0, t), box.top - 8);
  await page.waitForTimeout(1500);

  // Check nothing is cut off or overlapping
  const check = await page.evaluate(() => {
    const q = (s) => document.querySelector(s).getBoundingClientRect(), bar = q(".mdfc-bar");
    const above = [".mdfc-stage", ".mdfc-products", ".mdfc-sizes", ".mdfc-range.is-on"].map((s) => [s, q(s).top >= 0 && q(s).bottom <= bar.top]);
    const inBar = [".mdfc-paytoggle", ".mdfc-weekly", ".mdfc-compact-sub", ".mdfc-cta"].map((s) => [s, q(s).top >= bar.top && q(s).bottom <= innerHeight && q(s).right <= innerWidth]);
    const covering = [...document.elementsFromPoint(innerWidth / 2, bar.top + 20)].slice(0, 1).map((e) => e.closest("#mdf-price-calculator") ? "calculator" : (e.id || e.className || e.tagName));
    return { above, inBar, barShown: !document.querySelector(".mdfc-bar").classList.contains("is-hidden"), topElementOverBar: covering[0],
      figure: document.querySelector(".mdfc-big").textContent + " " + document.querySelector(".mdfc-per").textContent,
      tanNimbus: document.fonts.check("20px 'Tan Nimbus'") };
  });
  console.log(JSON.stringify(check));
  const bad = check.above.concat(check.inBar).filter((x) => !x[1]);
  if (bad.length || !check.barShown || check.topElementOverBar !== "calculator") throw new Error("Not all visible: " + JSON.stringify(bad) + " over bar: " + check.topElementOverBar);

  await page.screenshot({ path: OUT });
  console.log("saved", OUT, "errors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
