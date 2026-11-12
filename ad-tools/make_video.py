"""Animated video ad: layered background + the recorded calculator journey + text.

Usage (from the repo root):
    python3 ad-tools/make_video.py                 # uses existing layers and journey if present
    python3 ad-tools/make_video.py --rebuild       # re-make layers and re-record the journey first

Needs: ad-tools/layers/ (make_layers.py), ad-tools/out/journey/ (record_journey.js),
       ad-tools/fonts/TAN-NIMBUS.woff, ffmpeg, Node + Playwright.
Writes to ad-tools/out/:
    calculator-ad-4x5.mp4, calculator-ad-9x16.mp4             (with text)
    calculator-ad-4x5-notext.mp4, calculator-ad-9x16-notext.mp4
    video-contact-sheet-4x5.jpg, video-contact-sheet-9x16.jpg
All timings are in CONFIG below (seconds).
"""
import argparse
import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

# ============================== CONFIG ==============================
CONFIG = {
    "fps": 30,
    "scene_size": (1080, 1350),          # the 4:5 scene; the 9:16 is built around it
    # --- intro ---
    "swatch_fly": {"start": 0.0, "stagger": 0.05, "dur": 0.65, "from_scale": 0.35, "spin_deg": 25, "overshoot": 1.4},
    "motion_blur_px": 6,                  # blur fast movers when they travel more than this per frame
    "sparkle_pop": {"start": 0.45, "stagger": 0.06, "dur": 0.35, "overshoot": 2.2},
    "phone_rise": {"start": 0.3, "end": 1.0, "from_dy": 80, "fade": 0.06},
    "behind_phone_emerge": {"start": 0.85, "dur": 0.55, "dist": 0.35, "overshoot": 1.3},  # swatches tucked behind the phone
    "cloud_slide": {"start": 0.75, "dur": 0.6, "dist": 0.45, "overshoot": 1.5},          # slides out from behind the phone to the right
    # --- idle motion ---
    "float": {"amp_min": 3, "amp_max": 12, "rot_deg": 3.5, "period_min": 3.0, "period_max": 5.5, "blend_in": 0.5},
    "behind_float": {"amp": 2, "rot_deg": 0.8},
    "mascot_bob": {"amp": 6, "period": 2.6},
    "push_in": 0.04,                      # 4% slow push-in over the whole video
    # --- calculator journey ---
    "journey_start": 1.2,
    "tap": {"dur": 0.55, "r0": 14, "r1": 34, "colour": (16, 136, 140)},  # CSS px radius, teal ring
    "price_pulse": {"dur": 0.35, "scale": 0.05},
    "burst": {"count": 4, "dist": 26, "out": 0.18, "settle": 0.8},
    "hold_end": 2.0,
    # --- text (videos only) ---
    "text": {
        "line1": "Know your price", "line2": "before we knock", "strip": "SEE YOUR PRICE BEFORE WE VISIT",
        "white": "#ffffff", "pink": "#ff5fb8",
        "shadow": "0 4px 22px rgba(0,20,22,0.55), 0 2px 4px rgba(0,20,22,0.35)",
        "headline_size": 78, "strip_size": 36, "strip_height": 104,
        "word_start": 0.2, "word_gap": 0.08, "word_dur": 0.45, "word_rise": 30,
        "line2_start": 0.6, "line2_dur": 0.4,
        "strip_dur": 0.4,                 # slides up when the price first appears
    },
    "layout_4x5": {"size": (1080, 1350), "scene_y": 0, "headline_top": 44, "strip_bottom": 1350},
    "layout_9x16": {"size": (1080, 1920), "scene_y": 285, "headline_top": 255, "strip_bottom": 1920 - 340},
    "crf": 20,
}
# ====================================================================


def ease_out_back(u, s=1.7):
    u = min(max(u, 0.0), 1.0) - 1
    return 1 + (s + 1) * u ** 3 + s * u ** 2


def ease_out_cubic(u):
    u = min(max(u, 0.0), 1.0)
    return 1 - (1 - u) ** 3


def smoothstep(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def load_rgba(path, scale):
    im = Image.open(path).convert("RGBA")
    if scale != 1:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    a[..., :3] *= a[..., 3:]  # premultiplied
    return a


def composite(canvas, layer, M, opacity=1.0):
    """Alpha-composite a premultiplied RGBA layer onto canvas (float RGB 0..1) with affine M (2x3)."""
    h, w = layer.shape[:2]
    pts = np.array([[0, 0, 1], [w, 0, 1], [w, h, 1], [0, h, 1]], np.float32) @ M.T
    x0, y0 = np.floor(pts.min(0)).astype(int) - 2
    x1, y1 = np.ceil(pts.max(0)).astype(int) + 2
    H, W = canvas.shape[:2]
    x0c, y0c, x1c, y1c = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
    if x1c <= x0c or y1c <= y0c or opacity <= 0:
        return
    M2 = M.copy()
    M2[:, 2] -= [x0c, y0c]
    warped = cv2.warpAffine(layer, M2, (x1c - x0c, y1c - y0c), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    if opacity < 1:
        warped = warped * opacity
    sl = canvas[y0c:y1c, x0c:x1c]
    sl *= 1 - warped[..., 3:]
    sl += warped[..., :3]


def affine(cx, cy, dx, dy, s, rot_deg):
    """Scale + rotate about (cx, cy), then translate."""
    a = math.radians(rot_deg)
    c, si = math.cos(a) * s, math.sin(a) * s
    return np.array([[c, -si, cx - c * cx + si * cy + dx], [si, c, cy - si * cx - c * cy + dy]], np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rebuild", action="store_true")
    ap.add_argument("--only", choices=["4x5", "9x16"])
    a = ap.parse_args()
    C = CONFIG
    fps = C["fps"]

    if a.rebuild or not os.path.exists(os.path.join(HERE, "layers", "layers.json")):
        subprocess.run([sys.executable, os.path.join(HERE, "make_layers.py")], check=True)
    meta = json.load(open(os.path.join(HERE, "layers", "layers.json")))
    if a.rebuild or not os.path.exists(os.path.join(OUT, "journey", "journey.json")):
        subprocess.run(["node", os.path.join(HERE, "record_journey.js")], check=True)
    jmeta = json.load(open(os.path.join(OUT, "journey", "journey.json")))

    SW, SH = C["scene_size"]
    k = SW / meta["width"]  # layers are at 2160x2700; the scene is 1080x1350
    plate = np.asarray(Image.open(os.path.join(HERE, "layers", "plate.png")).convert("RGB").resize((SW, SH), Image.LANCZOS)).astype(np.float32) / 255
    centre = np.array([SW / 2, SH / 2])

    # ---- layers ----
    layers = []
    for L in meta["layers"]:
        img = load_rgba(os.path.join(HERE, "layers", L["file"]), k)
        layers.append(dict(L, img=img, x=L["x"] * k, y=L["y"] * k, cx=L["x"] * k + img.shape[1] / 2, cy=L["y"] * k + img.shape[0] / 2))
    phone = [L for L in layers if L["kind"] == "phone"][0]
    swatches = [L for L in layers if L["kind"] == "swatch"]
    rng = np.random.default_rng(7)
    sizes = np.array([max(L["img"].shape[:2]) for L in swatches])
    smin, smax = sizes.min(), sizes.max()
    # fly-in order: outermost first
    for i, L in enumerate(sorted(swatches, key=lambda L: -np.linalg.norm([L["cx"] - centre[0], L["cy"] - centre[1]]))):
        L["rank"] = i
    for L in layers:
        size = max(L["img"].shape[:2])
        L["sizen"] = (size - smin) / max(smax - smin, 1) if L["kind"] == "swatch" else 0.2
        f = C["float"]
        L["fl"] = dict(ax=f["amp_min"] + (f["amp_max"] - f["amp_min"]) * L["sizen"], px=rng.uniform(f["period_min"], f["period_max"]),
                       py=rng.uniform(f["period_min"], f["period_max"]), pr=rng.uniform(f["period_min"], f["period_max"]),
                       p1=rng.uniform(0, 6.28), p2=rng.uniform(0, 6.28), p3=rng.uniform(0, 6.28), rd=f["rot_deg"] * (0.5 + L["sizen"]) * rng.choice([-1, 1]))
        d = np.array([L["cx"], L["cy"]]) - centre
        L["dir"] = d / (np.linalg.norm(d) + 1e-6)
        L["spin"] = rng.uniform(-1, 1) * C["swatch_fly"]["spin_deg"]
    pcx, pcy = phone["cx"], phone["cy"]
    sparks = sorted([L for L in layers if L["kind"] in ("sparkle", "dot")], key=lambda L: L["cx"] + L["cy"])
    for i, L in enumerate(sparks):
        L["rank"] = i
    # burst: the biggest front swatches nearest the phone
    fronts = [L for L in swatches if L["z"] == "front"]
    fronts.sort(key=lambda L: np.linalg.norm([L["cx"] - pcx, L["cy"] - pcy]) - 0.5 * max(L["img"].shape[:2]))
    for L in fronts[: C["burst"]["count"]]:
        L["burst"] = True

    # ---- phone screen: alpha of the glass (vs bezel), and its corners in phone-local coords ----
    pimg = phone["img"]
    prgb = np.where(pimg[..., 3:] > 0, pimg[..., :3] / np.maximum(pimg[..., 3:], 1e-6), 0)
    quad = np.array(meta["screen_corners"]) * k - [phone["x"], phone["y"]]
    smask = np.zeros(pimg.shape[:2], np.uint8)
    cv2.fillPoly(smask, [np.round(quad).astype(np.int32)], 1)
    glass = (np.linalg.norm(prgb * 255 - [209, 236, 253], axis=2) < 30) & (smask > 0)  # the rounded screen itself
    inner = cv2.erode(glass.astype(np.uint8), np.ones((5, 5), np.uint8))
    near = cv2.dilate(smask, np.ones((5, 5), np.uint8))
    ring = cv2.dilate(near, np.ones((7, 7), np.uint8)) - near
    screen_col = np.median(prgb[inner > 0], axis=0)
    bezel_col = np.median(prgb[(ring > 0) & (pimg[..., 3] > 0.9)], axis=0)
    v = screen_col - bezel_col
    salpha = np.clip(((prgb - bezel_col) @ v) / (v @ v), 0, 1)
    salpha[near == 0] = 0
    salpha[inner > 0] = 1
    salpha = salpha[..., None].astype(np.float32)
    residual = np.clip(prgb - salpha * screen_col, 0, None)
    residual = np.minimum(residual, 1 - salpha)
    tw = int(round(np.linalg.norm(quad[1] - quad[0]) * 1.5))
    th = int(round(np.linalg.norm(quad[3] - quad[0]) * 1.5))
    src = np.array([[-0.5, -0.5], [tw - 0.5, -0.5], [tw - 0.5, th - 0.5], [-0.5, th - 0.5]], np.float32)
    qc = quad.mean(0)
    dst = qc + (quad - qc) * (1 + 1.0 / np.linalg.norm(quad - qc, axis=1))[:, None]
    PM = cv2.getPerspectiveTransform(src, dst.astype(np.float32))

    # ---- journey frames ----
    jdir = os.path.join(OUT, "journey")
    jframes = sorted(f for f in os.listdir(jdir) if f.endswith(".jpg"))
    dsf = jmeta["dsf"]
    t_price = C["journey_start"] + jmeta["priceTime"]
    journey_len = len(jframes) / fps
    total = C["journey_start"] + journey_len + C["hold_end"]
    n_frames = int(round(total * fps))
    print("video: %.2fs, %d frames; price moment at %.2fs" % (total, n_frames, t_price))


    def screen_frame(t):
        """The calculator at video time t, with tap rings and the price-bar pulse, sized for the warp."""
        jt = t - C["journey_start"]
        fi = int(min(max(jt, 0) * fps, len(jframes) - 1))
        img = cv2.imread(os.path.join(jdir, jframes[fi]))[..., ::-1].astype(np.float32) / 255
        # price-bar pulse
        pp = C["price_pulse"]
        u = (t - t_price) / pp["dur"]
        if 0 <= u <= 1:
            bx, by, bw, bh = [v * dsf for v in jmeta["bar"]]
            by, bh = int(by), int(bh)
            s = 1 + pp["scale"] * math.sin(math.pi * u)
            bar = img[by:by + bh].copy()
            big = cv2.resize(bar, None, fx=s, fy=s, interpolation=cv2.INTER_LINEAR)
            ox, oy = (big.shape[1] - bar.shape[1]) // 2, (big.shape[0] - bar.shape[0]) // 2
            img[by:by + bh] = big[oy:oy + bh, ox:ox + bar.shape[1]] * (1 + 0.12 * math.sin(math.pi * u))
            img = np.clip(img, 0, 1)
        # tap rings
        tc = C["tap"]
        for tp in jmeta["taps"]:
            u = (jt - tp["t"]) / tc["dur"]
            if 0 <= u <= 1:
                r = (tc["r0"] + (tc["r1"] - tc["r0"]) * ease_out_cubic(u)) * dsf
                alpha = (1 - u) ** 1.5
                ov = img.copy()
                col = np.array(tc["colour"], np.float32) / 255
                cv2.circle(ov, (int(tp["x"] * dsf), int(tp["y"] * dsf)), int(r), col.tolist(), -1, cv2.LINE_AA)
                img = img * (1 - 0.28 * alpha) + ov * 0.28 * alpha
                ov2 = img.copy()
                cv2.circle(ov2, (int(tp["x"] * dsf), int(tp["y"] * dsf)), int(r), col.tolist(), max(2, int(2.2 * dsf)), cv2.LINE_AA)
                img = img * (1 - 0.8 * alpha) + ov2 * 0.8 * alpha
        return cv2.resize(img, (tw, th), interpolation=cv2.INTER_AREA)

    def phone_with_screen(t):
        scr = cv2.warpPerspective(screen_frame(t), PM, (pimg.shape[1], pimg.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        rgb = salpha * scr + residual
        out = pimg.copy()
        out[..., :3] = np.where(near[..., None] > 0, rgb * pimg[..., 3:], pimg[..., :3])
        return out

    def burst_offset(t):
        b = C["burst"]
        u = t - t_price
        if u < 0:
            return 0.0
        if u < b["out"]:
            return ease_out_cubic(u / b["out"])
        w = u - b["out"]
        return math.exp(-w * 5.5) * math.cos(w * 9)

    def layer_state(L, t):
        """(dx, dy, scale, rot, opacity) for layer L at time t, before the global push-in."""
        dx = dy = rot = 0.0
        s, op = 1.0, 1.0
        fl = L["fl"]
        kind = L["kind"]
        if kind == "phone":
            pr = C["phone_rise"]
            u = (t - pr["start"]) / (pr["end"] - pr["start"])
            dy = pr["from_dy"] * (1 - ease_out_cubic(u))
            op = min(max((t - pr["start"]) / pr["fade"], 0), 1)
            return dx, dy, s, rot, op
        if kind == "cloud":
            cs = C["cloud_slide"]
            u = (t - cs["start"]) / cs["dur"]
            w = L["img"].shape[1]
            dx = -cs["dist"] * w * (1 - ease_out_back(u, cs["overshoot"]))
            op = min(max(u * 4, 0), 1)
            mb = C["mascot_bob"]
            dy = mb["amp"] * math.sin(2 * math.pi * t / mb["period"]) * smoothstep((t - cs["start"] - cs["dur"]) / 0.5)
            return dx, dy, s, rot, op
        if kind in ("sparkle", "dot"):
            sp = C["sparkle_pop"]
            u = (t - sp["start"] - L["rank"] * sp["stagger"]) / sp["dur"]
            s = max(ease_out_back(u, sp["overshoot"]), 0) if u < 1 else 1.0
            op = 1.0 if u > 0 else 0.0
            settle = sp["start"] + L["rank"] * sp["stagger"] + sp["dur"]
        elif L["z"] == "behind_phone":
            be = C["behind_phone_emerge"]
            u = (t - be["start"]) / be["dur"]
            w = max(L["img"].shape[:2])
            p = ease_out_back(u, be["overshoot"])
            to_phone = np.array([pcx - L["cx"], pcy - L["cy"]])
            to_phone /= np.linalg.norm(to_phone) + 1e-6
            dx, dy = to_phone * be["dist"] * w * (1 - p)
            op = min(max(u * 3, 0), 1)
            settle = be["start"] + be["dur"]
            bf = C["behind_float"]
            blend = smoothstep((t - settle) / C["float"]["blend_in"])
            dx += bf["amp"] * math.sin(2 * math.pi * t / fl["px"] + fl["p1"]) * blend
            dy += bf["amp"] * math.sin(2 * math.pi * t / fl["py"] + fl["p2"]) * blend
            rot += bf["rot_deg"] * math.sin(2 * math.pi * t / fl["pr"] + fl["p3"]) * blend
            return dx, dy, s, rot, op
        else:
            sf = C["swatch_fly"]
            t0 = sf["start"] + L["rank"] * sf["stagger"]
            u = (t - t0) / sf["dur"]
            p = ease_out_back(u, sf["overshoot"]) if u < 1 else 1.0
            # start just off the nearest edge along the line from the centre
            d = L["dir"]
            far = []
            for comp, pos, lim in ((d[0], L["cx"], SW), (d[1], L["cy"], SH)):
                if comp > 1e-3:
                    far.append((lim - pos + max(L["img"].shape[:2])) / comp)
                elif comp < -1e-3:
                    far.append((pos + max(L["img"].shape[:2])) / -comp)
            dist = min(far) if far else 600
            dx, dy = d * dist * (1 - p)
            s = sf["from_scale"] + (1 - sf["from_scale"]) * min(max(p, 0), 1.2)
            rot = L["spin"] * (1 - p)
            op = 1.0 if u > 0 else 0.0
            settle = t0 + sf["dur"]
            if L.get("burst"):
                bo = burst_offset(t) * C["burst"]["dist"]
                dx += L["dir"][0] * bo
                dy += L["dir"][1] * bo
        blend = smoothstep((t - settle) / C["float"]["blend_in"])
        dx += fl["ax"] * math.sin(2 * math.pi * t / fl["px"] + fl["p1"]) * blend
        dy += fl["ax"] * 0.8 * math.sin(2 * math.pi * t / fl["py"] + fl["p2"]) * blend
        rot += fl["rd"] * math.sin(2 * math.pi * t / fl["pr"] + fl["p3"]) * blend
        return dx, dy, s, rot, op

    order = sorted(layers, key=lambda L: (L["order"], -L["sizen"]))

    def layer_matrix(L, st, yoff):
        dx, dy, sc, rot, _ = st
        h, w = L["img"].shape[:2] if L["kind"] != "phone" else phone["img"].shape[:2]
        # scale/rotate about the layer's own centre, then move it to its place in the frame
        return affine(w / 2, h / 2, L["x"] + dx, L["y"] + dy + yoff, sc, rot)

    def bbox(img, M):
        h, w = img.shape[:2]
        pts = np.array([[0, 0, 1], [w, 0, 1], [w, h, 1], [0, h, 1]], np.float32) @ M.T
        return np.floor(pts.min(0)).astype(int) - 2, np.ceil(pts.max(0)).astype(int) + 2

    def render_scene(t, canvas, yoff):
        canvas[:] = base_plate
        H_, W_ = canvas.shape[:2]
        for L in order:
            st = layer_state(L, t)
            if st[4] <= 0 or st[2] <= 0.01:
                continue
            img = phone_with_screen(t) if L["kind"] == "phone" else L["img"]
            prev = layer_state(L, t - 1 / fps)
            speed = math.hypot(st[0] - prev[0], st[1] - prev[1]) + abs(st[2] - prev[2]) * max(img.shape[:2])
            n = 1 if (speed < C["motion_blur_px"] or L["kind"] == "phone") else min(7, 2 + int(speed / C["motion_blur_px"]))
            if n == 1:
                composite(canvas, img, layer_matrix(L, st, yoff), st[4])
                continue
            # motion blur: average n sub-frame samples (premultiplied) within their union box
            sts = [layer_state(L, t - (j / (n - 1) - 0.5) / fps) for j in range(n)]
            Ms = [layer_matrix(L, x, yoff) for x in sts]
            lo = np.min([bbox(img, M)[0] for M in Ms], 0)
            hi = np.max([bbox(img, M)[1] for M in Ms], 0)
            x0, y0 = max(lo[0], 0), max(lo[1], 0)
            x1, y1 = min(hi[0], W_), min(hi[1], H_)
            if x1 <= x0 or y1 <= y0:
                continue
            acc = np.zeros((y1 - y0, x1 - x0, 4), np.float32)
            for M, x in zip(Ms, sts):
                M2 = M.copy()
                M2[:, 2] -= [x0, y0]
                acc += cv2.warpAffine(img, M2, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR) * x[4]
            acc /= n
            sl = canvas[y0:y1, x0:x1]
            sl *= 1 - acc[..., 3:]
            sl += acc[..., :3]
        return canvas

    # ---- text layers ----
    def make_text(layout, name):
        tc = C["text"]
        W_, H_ = layout["size"]
        spec = dict(width=W_, height=H_, headlineTop=layout["headline_top"], stripTop=layout["strip_bottom"] - tc["strip_height"],
                    stripHeight=tc["strip_height"], line1=tc["line1"], line2=tc["line2"], strip=tc["strip"],
                    headlineSize=tc["headline_size"], stripSize=tc["strip_size"], white=tc["white"], pink=tc["pink"], shadow=tc["shadow"])
        tdir = os.path.join(OUT, "text-" + name)
        os.makedirs(tdir, exist_ok=True)
        sp = os.path.join(tdir, "spec.json")
        json.dump(spec, open(sp, "w"))
        subprocess.run(["node", os.path.join(HERE, "render_text.js"), sp, tdir], check=True)
        boxes = json.load(open(os.path.join(tdir, "boxes.json")))
        return {kk: (load_rgba(os.path.join(tdir, kk + ".png"), 1), b) for kk, b in boxes.items()}

    def draw_text(frame, text, t):
        tc = C["text"]
        words = sorted([kk for kk in text if kk.startswith("word-")])
        for i, kk in enumerate(words):
            img, b = text[kk]
            u = (t - tc["word_start"] - i * tc["word_gap"]) / tc["word_dur"]
            if u <= 0:
                continue
            dy = tc["word_rise"] * (1 - ease_out_back(u, 2.0)) if u < 1 else 0
            composite(frame, img, np.array([[1, 0, b["x"]], [0, 1, b["y"] + dy]], np.float32), min(u * 2.5, 1))
        img, b = text["line-2"]
        u = (t - tc["line2_start"]) / tc["line2_dur"]
        if u > 0:
            s = 1.0 if u >= 1 else (0.9 + 0.15 * smoothstep(u / 0.6) if u < 0.6 else 1.05 - 0.05 * smoothstep((u - 0.6) / 0.4))
            cx, cy = b["x"] + img.shape[1] / 2, b["y"] + img.shape[0] / 2
            M = affine(img.shape[1] / 2, img.shape[0] / 2, cx - img.shape[1] / 2, cy - img.shape[0] / 2, s, 0)
            composite(frame, img, M, min(u / 0.375, 1))
        img, b = text["strip"]
        u = (t - t_price) / tc["strip_dur"]
        if u > 0:
            dy = (1 - ease_out_cubic(u)) * (img.shape[0] + 10)
            # clip the slide to the strip's own band so it rises out of the bottom edge
            band = frame[b["y"]:b["y"] + img.shape[0]]
            tmp = band.copy()
            composite(tmp, img, np.array([[1, 0, b["x"]], [0, 1, dy]], np.float32), 1.0)
            band[:] = tmp

    # ---- render ----
    formats = ["4x5", "9x16"] if not a.only else [a.only]
    for name in formats:
        layout = C["layout_" + name]
        W_, H_ = layout["size"]
        yoff = layout["scene_y"]
        # plate, extended with the same teal above and below the 4:5 scene
        bp = np.zeros((H_, W_, 3), np.float32)
        bp[yoff:yoff + SH] = plate
        if yoff > 0:
            top = np.repeat(plate[:1], yoff, 0)
            bp[:yoff] = cv2.GaussianBlur(top, (0, 0), sigmaX=6, sigmaY=0.1)
        if yoff + SH < H_:
            n_ = H_ - yoff - SH
            bp[yoff + SH:] = cv2.GaussianBlur(np.repeat(plate[-1:], n_, 0), (0, 0), sigmaX=6, sigmaY=0.1)
        if yoff > 0 or yoff + SH < H_:
            # soften the joins
            for yj in (yoff, yoff + SH):
                if 0 < yj < H_:
                    lo, hi = max(yj - 40, 0), min(yj + 40, H_)
                    bp[lo:hi] = cv2.GaussianBlur(bp[lo:hi], (0, 0), sigmaX=0.1, sigmaY=14)
        global base_plate
        base_plate = bp
        text = make_text(layout, name)
        canvas = np.zeros((H_, W_, 3), np.float32)

        outs = {}
        for tag in ("", "-notext"):
            path = os.path.join(OUT, "calculator-ad-%s%s.mp4" % (name, tag))
            outs[tag] = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W_, H_),
                                          "-r", str(fps), "-i", "-", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", str(C["crf"]),
                                          "-pix_fmt", "yuv420p", "-movflags", "+faststart", path], stdin=subprocess.PIPE)
        samples = {}
        sample_times = [x * 0.5 for x in range(7)] + list(range(4, int(total) + 1))
        hold_from = C["journey_start"] + journey_len
        last = None
        for i in range(n_frames):
            t = i / fps
            if t >= hold_from and last is not None:
                scene, framet = last
            else:
                tt = t
                render_scene(tt, canvas, yoff)
                # push-in on the whole scene (text stays still)
                s = 1 + C["push_in"] * smoothstep(tt / hold_from)
                M = affine(W_ / 2, yoff + SH / 2, 0, 0, s, 0)
                scene = cv2.warpAffine(canvas, M, (W_, H_), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
                framet = tt
                last = (scene, framet)
            notext = (np.clip(scene, 0, 1) * 255 + 0.5).astype(np.uint8)
            withtext = scene.copy()
            draw_text(withtext, text, t)
            withtext = (np.clip(withtext, 0, 1) * 255 + 0.5).astype(np.uint8)
            outs["-notext"].stdin.write(notext.tobytes())
            outs[""].stdin.write(withtext.tobytes())
            for st in sample_times:
                if st not in samples and abs(t - st) < 0.5 / fps:
                    samples[st] = withtext
            if i % 30 == 0:
                print("\r  %s: frame %d/%d" % (name, i, n_frames), end="", flush=True)
        for p_ in outs.values():
            p_.stdin.close()
            p_.wait()
        print("\r  %s: %d frames written" % (name, n_frames))
        # contact sheet
        keys = sorted(samples)
        th_w = 270
        th_h = int(th_w * H_ / W_)
        cols = 6
        rows = (len(keys) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (th_w + 8), rows * (th_h + 26)), "white")
        dr = ImageDraw.Draw(sheet)
        for j, kk in enumerate(keys):
            im = Image.fromarray(samples[kk]).resize((th_w, th_h), Image.LANCZOS)
            x, y = (j % cols) * (th_w + 8), (j // cols) * (th_h + 26)
            sheet.paste(im, (x, y + 22))
            dr.text((x + 4, y + 4), "%.1fs" % kk, fill=(1, 61, 63))
        sheet.save(os.path.join(OUT, "video-contact-sheet-%s.jpg" % name), quality=88)
    print("done:", ", ".join(sorted(f for f in os.listdir(OUT) if f.endswith(".mp4"))))


base_plate = None

if __name__ == "__main__":
    main()
