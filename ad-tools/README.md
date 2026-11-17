# Ad tools

Makes the "get my price" ads from `ad-background.jpg` and the **real, live calculator**. None of the calculator code is changed. Everything here can be re-run, including with a new background.

## Still image

```bash
python3 ad-tools/make_ad.py                                    # uses ad-tools/ad-background.jpg
python3 ad-tools/make_ad.py --background path/to/new-bg.jpg
```

Writes `out/ad-calculator-4x5.png` (1080×1350) and `out/ad-calculator-4x5@2x.png` (2160×2700), with no text, plus 100% crops of the phone (`out/check-*.png`).

1. **Screen detection:** finds the phone screen (the big plain light-blue area, about rgb 209, 237, 251) and fits its four edges for the corners.
2. **Capture:** `render_calculator.js` captures the live page (`mydreamflooring.co.uk/how-many-rooms-can-i-afford/`) at 390px wide, deviceScaleFactor 3, with the viewport height matched to the screen's shape. It fills in Carpet, Living room, Medium, Westminster and Weekly.
3. **Compositing:** the background is upscaled with Lanczos straight to the output size, which avoids resampling twice and keeps the calculator text sharpest. The screenshot is then warped onto the screen with a perspective transform and masked to the rounded screen.

## Layers

```bash
python3 ad-tools/make_layers.py
```

Splits the (upscaled) background into `layers/`:

- **`plate.png`:** the clean teal gradient and glow, with the objects removed and rebuilt.
- **`phone.png`**, **`cloud.png`**
- **`swatch-NN.png`**, **`sparkle-NN.png`** and **`dot-NN.png`:** every flooring swatch, sparkle and pink dot.
- **`layers.json`:** each layer's position, size and depth (behind the phone, in front, or in front of the phone).
- **`contact-sheet.png`:** every layer on a checkerboard.

How it splits them:

- **Phone outline:** rembg u2net, combined with the measured width of the phone's metal frame.
- **Everything else:** separated from the plate by colour difference and shape.
- **Depth:** objects touching the phone are treated as behind it, apart from any listed in `FRONT_OF_PHONE_NEAR` at the top of `make_layers.py`. For this background, that's the patterned tile in front of the phone's bottom-right corner. Update the list for a new background.
- **Hidden parts:** for objects behind the phone, a band hidden under the phone's edge is rebuilt, so small movements don't show a cut edge. Those rebuilt bands are rough, because they're meant to stay hidden.

## Video

```bash
python3 ad-tools/make_video.py              # uses existing layers and journey
python3 ad-tools/make_video.py --rebuild    # re-make the layers and re-record the journey first
```

Writes to `out/`:

- **`calculator-ad-4x5.mp4`** (1080×1350) and **`calculator-ad-9x16.mp4`** (1080×1920), with text.
- **`calculator-ad-4x5-notext.mp4`** and **`calculator-ad-9x16-notext.mp4`**, without text.
- **`video-contact-sheet-4x5.jpg`** and **`video-contact-sheet-9x16.jpg`**.

All four are H.264, yuv420p, CRF 20, 30fps, with no audio.

- **Journey** (`record_journey.js`): a real tap-through of the live calculator, recorded at 30fps with the page's clock frozen and stepped 1/30s per frame, so the price count-up and the 3D floor fade come out perfectly smooth. Tap rings and the price-bar pulse are drawn afterwards from the recorded tap positions.
- **Text** (`render_text.js`): rendered in a browser, so it stays crisp. "Know your price" / "before we knock" is in Tan Nimbus (`fonts/TAN-NIMBUS.woff`). The strip is Montserrat Bold from Google Fonts. Each word, line and the strip is its own transparent layer.
- **Settings:** every timing, size and layout setting is in the `CONFIG` block at the top of `make_video.py`.

## Needs

- Python 3 with numpy, Pillow, opencv-python-headless and rembg (`pip install opencv-python-headless rembg onnxruntime`). rembg downloads its model the first time it runs.
- Node with Playwright.
- ffmpeg.
