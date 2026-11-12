/*
 * Record the "get my price" calculator journey as 30fps frames for the video ad.
 *
 *   node ad-tools/record_journey.js [--height 884] [--out ad-tools/out/journey] [--url <page>] [--no-local]
 *
 * Deterministic: the page's clock is frozen and stepped exactly 1/30s per frame,
 * so animations (price count-up, 3D floor fade, scrolling) come out smooth no
 * matter how slow each screenshot is. Taps are real touch events; the tap
 * indicator is drawn later (make_video.py) from the recorded tap positions.
 *
 * Writes frame_0000.jpg ... and journey.json (fps, taps, price moment, size).
 * The calculator always starts with a default room picked (Living room, Medium,
 * Westminster), so the recording starts from Vinyl / Bedroom / Small instead,
 * so that every tap in the journey visibly changes something.
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const HEIGHT = parseInt(arg("--height", "884"), 10);
const OUT = arg("--out", path.join(__dirname, "out", "journey"));
const PAGE_URL = arg("--url", "https://mydreamflooring.co.uk/how-many-rooms-can-i-afford/");
const LOCAL = !args.includes("--no-local");
const REPO = path.join(__dirname, "..");
const FPS = 30;

// Journey timeline (seconds from the start of the recording)
const STEPS = [
  { t: 0.9, tap: "#mdfc-prod-carpet", name: "Carpet" },
  { t: 1.8, tap: '[data-type="Living room"]', name: "Living room" },
  { t: 2.7, tap: "#mdfc-size-medium", name: "Medium" },
  { t: 3.5, scrollTo: "carpets", dur: 1.4 },
  { t: 5.6, tap: "label[for=mdfc-range-westminster]", name: "Westminster", price: true },
  { t: 7.1, tap: "label[for=mdfc-pay-monthly]", name: "Monthly" },
  { t: 8.1, tap: "label[for=mdfc-pay-weekly]", name: "Weekly" },
];
const END = 9.2;

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: HEIGHT }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
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

  // Starting state (so each journey tap visibly changes something)
  await page.tap("#mdfc-prod-vinyl");
  await page.tap('[data-type="Bedroom"]');
  await page.tap("#mdfc-size-small");
  await page.tap("label[for=mdfc-range-balmoral]");
  await page.tap("label[for=mdfc-pay-weekly]");
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelector(".mdfc-stage-loading").hidden, null, { timeout: 30000 });
  // pre-load every texture used in the journey so nothing pops in mid-video
  await page.tap("#mdfc-prod-carpet"); await page.waitForTimeout(1500);
  await page.tap("#mdfc-prod-vinyl"); await page.tap("label[for=mdfc-range-balmoral]"); await page.waitForTimeout(1500);

  // Start position: the calculator's header at the top of the screen
  const scrollFor = (which) => page.evaluate((w) => {
    const y = window.scrollY, q = (s) => document.querySelector(s).getBoundingClientRect();
    if (w === "start") return Math.round(q(".mdfc-head").top + y - 10);
    return Math.round(q(".mdfc-stage").top + y - 8); // the still's framing: room preview to Westminster card
  }, which);
  const y0 = await scrollFor("start");
  await page.evaluate((y) => window.scrollTo(0, y), y0);
  await page.waitForTimeout(1200);

  // Freeze the page's clock; from here on time only moves when we step it
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.clock.runFor(1000);

  const taps = [];
  let priceTime = null, scroll = null;
  const n = Math.round(END * FPS);
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    for (const s of STEPS) {
      if (s.done || t < s.t) continue;
      s.done = true;
      if (s.tap) {
        const r = await page.evaluate((sel) => {
          const el = document.querySelector(sel); const b = el.getBoundingClientRect();
          return [b.left + b.width / 2, b.top + b.height / 2];
        }, s.tap);
        await page.touchscreen.tap(r[0], r[1]);
        taps.push({ t, x: r[0], y: r[1], name: s.name });
        if (s.price && priceTime === null) priceTime = t;
      } else if (s.scrollTo) {
        scroll = { from: await page.evaluate(() => window.scrollY), to: await scrollFor(s.scrollTo), t0: t, dur: s.dur };
      }
    }
    if (scroll) {
      const k = Math.min(1, (t - scroll.t0) / scroll.dur);
      await page.evaluate((y) => window.scrollTo(0, y), scroll.from + (scroll.to - scroll.from) * ease(k));
      if (k >= 1) scroll = null;
    }
    await page.clock.runFor(1000 / FPS);
    await page.screenshot({ type: "jpeg", quality: 92, path: path.join(OUT, `frame_${String(i).padStart(4, "0")}.jpg`) });
    if (i % 30 === 0) process.stdout.write(`\r  recorded ${i}/${n} frames`);
  }
  const bar = await page.evaluate(() => { const b = document.querySelector(".mdfc-bar").getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
  const finalFigure = await page.evaluate(() => document.querySelector(".mdfc-big").textContent + " " + document.querySelector(".mdfc-per").textContent);
  fs.writeFileSync(path.join(OUT, "journey.json"), JSON.stringify({ fps: FPS, frames: n, width: 390, height: HEIGHT, dsf: 3, taps, priceTime, bar, finalFigure }, null, 1));
  console.log(`\n  done: ${n} frames, taps: ${taps.map((x) => x.name + "@" + x.t.toFixed(2)).join(", ")}, final ${finalFigure}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
