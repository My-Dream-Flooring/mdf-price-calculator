# Ad tools

Puts the real "get my price" calculator onto the phone in an ad background. None of the calculator code is changed.

```bash
python3 ad-tools/make_ad.py                                    # uses ad-tools/ad-background.jpg
python3 ad-tools/make_ad.py --background path/to/new-bg.jpg    # a new background
python3 ad-tools/make_ad.py --screenshot existing-screen.png   # reuse a screenshot
```

Output goes to `ad-tools/out/` (not committed):

| File | Size |
|---|---|
| `ad-calculator-4x5@2x.png` | 2160 × 2700 |
| `ad-calculator-4x5.png` | 1080 × 1350 |
| `check-phone-100pct*.png` | 100% crops of the phone, for checking edges and the price bar |
| `calculator-screen.png` | The raw calculator screenshot |

How it works:

1. **Finds the phone screen** in the background: the largest plain light-blue area (about rgb 209, 237, 251). Fits a line to each edge, ignoring the rounded corners, and intersects them for the four corners.
2. **Renders the calculator** (`render_calculator.js`, Playwright): the live page `mydreamflooring.co.uk/how-many-rooms-can-i-afford/`, 390px wide, deviceScaleFactor 3, viewport height matched to the phone screen's shape. It fills in Carpet, Living room, Medium, Westminster and Weekly, then scrolls so the room preview, flooring, size boxes, Westminster card and the whole price bar are visible. It stops with an error if they can't all fit. The calculator's files are served from this repo (identical to GitHub Pages); add `--no-local` to fetch them from GitHub Pages instead.
3. **Composites:** crops the background to 4:5, upscales it with Lanczos to 2160 × 2700, warps the screenshot onto the screen with a perspective transform, and masks it to the exact screen shape. Edge pixels keep their share of the black bezel, so there's no halo or overlap.

A new background works as long as the phone screen is a plain light-blue area. If its colour is different, change `SCREEN_RGB` at the top of `make_ad.py`.

Needs Python 3 with numpy, Pillow and opencv-python-headless (`pip install opencv-python-headless`), plus Node with Playwright.
