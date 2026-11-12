/*
 * Render the video ad's text as separate transparent PNGs (crisp, composited later).
 *
 *   node ad-tools/render_text.js <spec.json> <outdir>
 *
 * spec: { width, height, headlineTop, stripTop, stripHeight, line1, line2, strip,
 *         headlineSize, stripSize, white, pink, shadow }
 * Writes word-1.png ... (each word of line 1), line-2.png, strip.png and boxes.json
 * (each element's x, y, w, h in the frame, including its shadow padding).
 * Fonts: Tan Nimbus from ad-tools/fonts/TAN-NIMBUS.woff; Montserrat 700 from Google Fonts.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const [specPath, outDir] = process.argv.slice(2);
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const fontFile = path.join(__dirname, "fonts", "TAN-NIMBUS.woff");
  if (!fs.existsSync(fontFile)) throw new Error("Missing " + fontFile);
  const fontB64 = fs.readFileSync(fontFile).toString("base64");
  const PAD = 40; // room for the shadow around each element
  const words = spec.line1.split(/\s+/);

  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=block" rel="stylesheet">
<style>
@font-face { font-family: "Tan Nimbus"; src: url(data:font/woff;base64,${fontB64}) format("woff"); font-display: block; }
html, body { margin: 0; background: transparent; width: ${spec.width}px; height: ${spec.height}px; overflow: hidden; }
.head { position: absolute; left: 0; right: 0; top: ${spec.headlineTop - PAD}px; text-align: center; font-family: "Tan Nimbus"; font-size: ${spec.headlineSize}px; line-height: 1.02; }
.line { display: block; white-space: nowrap; }
.w { display: inline-block; padding: ${PAD}px; margin: 0 ${-PAD + spec.headlineSize * 0.12}px; color: ${spec.white}; text-shadow: ${spec.shadow}; }
.l2 { display: inline-block; padding: ${PAD}px; margin-top: ${-2 * PAD}px; color: ${spec.pink}; text-shadow: ${spec.shadow}; }
.strip { position: absolute; left: 0; right: 0; top: ${spec.stripTop}px; height: ${spec.stripHeight}px; background: ${spec.pink};
  display: flex; align-items: center; justify-content: center; color: #fff; font-family: "Montserrat"; font-weight: 700;
  font-size: ${spec.stripSize}px; letter-spacing: 0.04em; white-space: nowrap; }
</style></head><body>
<div class="head"><span class="line">${words.map((w, i) => `<span class="w" id="w${i + 1}">${w}</span>`).join("")}</span><span class="line"><span class="l2" id="l2">${spec.line2}</span></span></div>
<div class="strip" id="strip">${spec.strip}</div>
</body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: spec.width, height: spec.height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const fontsOk = await page.evaluate(() => ({ tan: document.fonts.check('40px "Tan Nimbus"'), mont: document.fonts.check('700 40px "Montserrat"') }));
  if (!fontsOk.tan) throw new Error("Tan Nimbus didn't load");
  if (!fontsOk.mont) throw new Error("Montserrat didn't load from Google Fonts");

  const boxes = {};
  const shoot = async (sel, name) => {
    // only the element being captured is visible, so neighbouring words don't creep into its padding
    await page.evaluate((s) => {
      document.querySelectorAll(".w, .l2, .strip").forEach((el) => { el.style.visibility = el.matches(s) ? "visible" : "hidden"; });
    }, sel);
    const b = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }, sel);
    await page.screenshot({ path: path.join(outDir, name + ".png"), omitBackground: true, clip: { x: b.x, y: b.y, width: b.w, height: b.h } });
    boxes[name] = b;
  };
  for (let i = 0; i < words.length; i++) await shoot("#w" + (i + 1), "word-" + (i + 1));
  await shoot("#l2", "line-2");
  await shoot("#strip", "strip");
  fs.writeFileSync(path.join(outDir, "boxes.json"), JSON.stringify(boxes, null, 1));
  console.log("text rendered:", Object.keys(boxes).join(", "), "| fonts", JSON.stringify(fontsOk));
  await browser.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
