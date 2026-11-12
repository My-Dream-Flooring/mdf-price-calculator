"""Put the real "get my price" calculator onto the phone in an ad background.

Usage (from the repo root):
    python3 ad-tools/make_ad.py                                  # uses ad-tools/ad-background.jpg
    python3 ad-tools/make_ad.py --background path/to/new-bg.jpg
    python3 ad-tools/make_ad.py --screenshot existing-screen.png  # skip rendering

What it does:
 1. Finds the phone screen: the largest plain light-blue area (about rgb 209,237,251).
    Fits a straight line to each of its four edges (ignoring the rounded corners)
    and intersects them to get the four corners.
 2. Renders the live calculator at 390px wide, deviceScaleFactor 3, with the viewport
    height matched to the screen's aspect ratio (ad-tools/render_calculator.js).
 3. Crops the background to 4:5, upscales it with Lanczos straight to the 2160x2700
    export size (a bit over 2x), and warps the screenshot onto the screen with a
    perspective transform.
 4. Masks it to the exact screen shape. For the anti-aliased rim it works out how
    much of each pixel was screen colour vs black bezel and swaps only the screen
    colour, so there's no halo and nothing painted over the bezel. Glare on the
    original glass edge is dropped so it doesn't show as a line on dark content.
 5. Saves ad-tools/out/ad-calculator-4x5@2x.png (2160x2700), ad-calculator-4x5.png
    (1080x1350, downscaled from the 2x), and 100% crops of the phone for checking.

Needs: Python 3 with numpy, Pillow, opencv-python(-headless); Node with Playwright.
"""
import argparse
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SCREEN_RGB = np.array([209, 237, 251])
OUT_W, OUT_H = 2160, 2700  # 4:5 @2x


def find_screen(bgr):
    """Return (corners TL,TR,BR,BL as float array, screen mask uint8) in image pixels."""
    rgb = bgr[..., ::-1].astype(np.int32)
    near = (np.sqrt(((rgb - SCREEN_RGB) ** 2).sum(2)) < 30).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(near, 8)
    if n < 2:
        sys.exit("No light-blue screen area found")
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    mask = (lab == big).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)[:, 0, :].astype(float)

    hull = cv2.convexHull(c.astype(np.float32))
    peri = cv2.arcLength(hull, True)
    q = None
    for eps in np.linspace(0.01, 0.1, 40):
        q = cv2.approxPolyDP(hull, eps * peri, True)
        if len(q) == 4:
            break
    if q is None or len(q) != 4:
        sys.exit("Couldn't find four sides on the screen area")
    q = q[:, 0, :]
    s, d = q.sum(1), np.diff(q, axis=1)[:, 0]
    quad = np.array([q[np.argmin(s)], q[np.argmin(d)], q[np.argmax(s)], q[np.argmax(d)]], float)

    def fit(quad):
        dists = []
        for i in range(4):
            a, b = quad[i], quad[(i + 1) % 4]
            u = (b - a) / np.linalg.norm(b - a)
            dists.append(np.abs((c - a) @ np.array([-u[1], u[0]])))
        owner = np.argmin(np.array(dists), axis=0)
        lines = []
        for i in range(4):
            pts = c[owner == i]
            a, b = quad[i], quad[(i + 1) % 4]
            L = np.linalg.norm(b - a)
            t = (pts - a) @ ((b - a) / L)
            sel = pts[(t > 0.25 * L) & (t < 0.75 * L)]  # straight middle of each edge only
            vx, vy, x0, y0 = cv2.fitLine(sel.astype(np.float32), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
            lines.append((np.array([x0, y0]), np.array([vx, vy])))

        def meet(l1, l2):
            t = np.linalg.solve(np.array([l1[1], -l2[1]]).T, l2[0] - l1[0])
            return l1[0] + t[0] * l1[1]
        return np.array([meet(lines[3], lines[0]), meet(lines[0], lines[1]), meet(lines[1], lines[2]), meet(lines[2], lines[3])])

    corners = fit(fit(quad))
    return corners, mask


def screen_aspect(corners):
    w = (np.linalg.norm(corners[1] - corners[0]) + np.linalg.norm(corners[2] - corners[3])) / 2
    h = (np.linalg.norm(corners[3] - corners[0]) + np.linalg.norm(corners[2] - corners[1])) / 2
    return h / w


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--background", default=os.path.join(HERE, "ad-background.jpg"))
    ap.add_argument("--screenshot", help="use this screenshot instead of rendering a new one")
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    bg0 = cv2.imread(a.background)
    if bg0 is None:
        sys.exit("Can't read " + a.background)
    corners0, mask0 = find_screen(bg0)
    aspect = screen_aspect(corners0)
    vh = round(390 * aspect)
    print("screen corners (TL TR BR BL):", np.round(corners0, 1).tolist())
    print("screen aspect h/w %.3f -> viewport 390 x %d" % (aspect, vh))

    shot_path = a.screenshot
    if not shot_path:
        shot_path = os.path.join(a.out, "calculator-screen.png")
        subprocess.run(["node", os.path.join(HERE, "render_calculator.js"), "--height", str(vh), "--out", shot_path], check=True)
    shot = cv2.imread(shot_path)

    # Crop the background to 4:5 (centred), then upscale with Lanczos to 2160x2700
    H0, W0 = bg0.shape[:2]
    if W0 / H0 > OUT_W / OUT_H:
        cw, ch = H0 * OUT_W / OUT_H, H0
    else:
        cw, ch = W0, W0 * OUT_H / OUT_W
    x0, y0 = (W0 - cw) / 2, (H0 - ch) / 2
    scale = OUT_W / cw
    bg_pil = Image.open(a.background).convert("RGB").crop((x0, y0, x0 + cw, y0 + ch)).resize((OUT_W, OUT_H), Image.LANCZOS)
    bg = np.asarray(bg_pil).astype(np.float32)  # RGB
    print("background %dx%d -> crop %.1fx%.1f -> %dx%d (x%.3f, Lanczos)" % (W0, H0, cw, ch, OUT_W, OUT_H, scale))

    # Same crop + scale for the corners and the mask (pixel-centre coordinates)
    to_out = lambda p: (np.asarray(p) + 0.5 - [x0, y0]) * scale - 0.5
    corners = to_out(corners0)
    A = np.array([[scale, 0, (0.5 - x0) * scale - 0.5], [0, scale, (0.5 - y0) * scale - 0.5]], np.float32)
    mask = cv2.warpAffine(mask0, A, (OUT_W, OUT_H), flags=cv2.INTER_LINEAR)

    # How much of each pixel is screen (1) vs bezel (0): project its colour onto
    # the line from the bezel colour to the screen colour.
    inner = cv2.erode((mask > 127).astype(np.uint8), np.ones((9, 9), np.uint8))
    near = cv2.dilate((mask > 127).astype(np.uint8), np.ones((9, 9), np.uint8))
    ring = cv2.dilate(near, np.ones((15, 15), np.uint8)) - near  # just outside the screen: the bezel
    screen_col = np.median(bg[inner > 0], axis=0)
    bezel_col = np.median(bg[ring > 0], axis=0)
    v = screen_col - bezel_col
    alpha = np.clip(((bg - bezel_col) @ v) / (v @ v), 0, 1)
    alpha[near == 0] = 0
    alpha[inner > 0] = 1
    print("screen colour", screen_col.round(), "bezel colour", bezel_col.round())

    # Warp the screenshot onto the screen. Pre-shrink it to roughly the target size
    # (area filter) so the perspective warp doesn't alias, and push the target
    # corners out 2px so the picture fully covers the anti-aliased rim.
    tw = int(round((np.linalg.norm(corners[1] - corners[0]) + np.linalg.norm(corners[2] - corners[3])) / 2))
    th = int(round((np.linalg.norm(corners[3] - corners[0]) + np.linalg.norm(corners[2] - corners[1])) / 2))
    small = cv2.resize(shot, (tw, th), interpolation=cv2.INTER_AREA)
    small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
    centre = corners.mean(0)
    dst = centre + (corners - centre) * (1 + 2 / np.linalg.norm(corners - centre, axis=1))[:, None]
    src = np.array([[-0.5, -0.5], [tw - 0.5, -0.5], [tw - 0.5, th - 0.5], [-0.5, th - 0.5]], np.float32)
    M = cv2.getPerspectiveTransform(src, dst.astype(np.float32))
    warped = cv2.warpPerspective(small, M, (OUT_W, OUT_H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)

    # Swap the screen colour for the screenshot, keeping the bezel's (dark) share
    # of each edge pixel. Any glare/highlight on the original glass is dropped,
    # so fully-screen pixels show the calculator's colours exactly.
    am = alpha[..., None]
    residual = np.clip(bg - am * screen_col, 0, None)
    residual = np.minimum(residual, (1 - am) * 255)
    out = np.clip(am * warped + residual, 0, 255).astype(np.uint8)
    img2 = Image.fromarray(out)
    img2.save(os.path.join(a.out, "ad-calculator-4x5@2x.png"), optimize=True)
    img1 = img2.resize((OUT_W // 2, OUT_H // 2), Image.LANCZOS)
    img1.save(os.path.join(a.out, "ad-calculator-4x5.png"), optimize=True)

    # 100% crops of the phone for checking edges and the price bar
    xs, ys = corners[:, 0], corners[:, 1]
    pad = 40
    box2 = (int(xs.min() - pad), int(ys.min() - pad), int(xs.max() + pad), int(ys.max() + pad))
    img2.crop(box2).save(os.path.join(a.out, "check-phone-100pct@2x.png"))
    img1.crop(tuple(v // 2 for v in box2)).save(os.path.join(a.out, "check-phone-100pct.png"))
    print("saved:", ", ".join(sorted(f for f in os.listdir(a.out) if f.endswith(".png"))))


if __name__ == "__main__":
    main()
