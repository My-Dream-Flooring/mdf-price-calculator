"""Split the ad background into separate transparent layers.

Usage (from the repo root):
    python3 ad-tools/make_layers.py [--background ad-tools/ad-background.jpg]

Output: ad-tools/layers/
    plate.png              clean background (teal gradient + glow), objects removed
    phone.png, cloud.png   the phone and the mascot
    swatch-NN.png          each flooring swatch
    sparkle-NN.png, dot-NN.png
    layers.json            every layer's position, size, centre, z-order and kind
    contact-sheet.png      every layer on a checkerboard

All layers are full-canvas-aligned at the still's scale: the background is cropped
to 4:5 and upscaled with Lanczos to 2160x2700 (same as make_ad.py), and each layer
PNG is cropped to its own box; layers.json gives the box so it goes back in exactly
the same place, size and rotation.

How it separates things (no ML needed, the background is a clean teal gradient):
 1. Teal pixels are found by hue/saturation. A smooth model of the background is
    fitted to them (2D polynomial) and the leftover fine detail is inpainted into
    the holes, giving a seamless plate.
 2. Every pixel's difference from the plate gives a soft alpha (so motion-blurred
    swatches keep their blur).
 3. Connected parts become layers. The phone is split off using the screen corners
    (screen outline pushed out to the frame edge).
 4. Objects touching the phone: if the hidden part under the phone looks like the
    object, it's in front (its full square is restored on top of the phone);
    otherwise it's behind, and its hidden part is rebuilt (square swatches) or
    mirrored (the cloud) so nothing looks cut off when it moves.
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))

# Objects touching the phone are treated as BEHIND it, except any whose centre is
# near one of these points (fractions of the image width, height). For
# ad-background.jpg the patterned tile at the phone's bottom-right corner is in
# front. Update this list for a new background.
FRONT_OF_PHONE_NEAR = [(0.71, 0.79)]
sys.path.insert(0, HERE)
from make_ad import find_screen, OUT_W, OUT_H  # noqa: E402


def teal_mask(rgb):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    h, s = hsv[..., 0] * 2, hsv[..., 1] / 255
    return (h > 165) & (h < 200) & (s > 0.45)


def fit_plate(img, bgmask, deg=5):
    """Smooth model of the background: per-channel 2D polynomial fitted to teal pixels."""
    H, W = bgmask.shape
    ys, xs = np.nonzero(bgmask)
    sel = np.random.default_rng(1).choice(len(xs), min(60000, len(xs)), replace=False)
    xs, ys = xs[sel], ys[sel]

    def basis(x, y):
        x = x / W - 0.5
        y = y / H - 0.5
        return np.stack([x ** i * y ** j for i in range(deg + 1) for j in range(deg + 1 - i)], -1)

    A = basis(xs.astype(float), ys.astype(float))
    gy, gx = np.mgrid[0:H, 0:W]
    B = basis(gx.ravel().astype(float), gy.ravel().astype(float))
    model = np.zeros_like(img, dtype=np.float32)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A, img[ys, xs, c].astype(float), rcond=None)
        for _ in range(2):  # trim outliers and refit
            r = A @ coef - img[ys, xs, c]
            keep = np.abs(r) < 3 * r.std() + 1
            coef, *_ = np.linalg.lstsq(A[keep], img[ys, xs, c][keep].astype(float), rcond=None)
        model[..., c] = (B @ coef).reshape(H, W)
    return model


def rounded_quad_mask(shape, quad, offsets, radius):
    """Mask of a quad whose sides are pushed outward by offsets[i], with rounded corners."""
    H, W = shape
    c = quad.mean(0)
    lines = []
    for i in range(4):
        a, b = quad[i], quad[(i + 1) % 4]
        u = (b - a) / np.linalg.norm(b - a)
        n = np.array([-u[1], u[0]])
        if n @ ((a + b) / 2 - c) < 0:  # point outward (test from the edge midpoint)
            n = -n
        lines.append((a + n * offsets[i], u))

    def meet(l1, l2):
        t = np.linalg.solve(np.array([l1[1], -l2[1]]).T, l2[0] - l1[0])
        return l1[0] + t[0] * l1[1]
    q = np.array([meet(lines[3], lines[0]), meet(lines[0], lines[1]), meet(lines[1], lines[2]), meet(lines[2], lines[3])])
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.round(q * 8).astype(np.int32)], 255, lineType=cv2.LINE_AA, shift=3)
    if radius > 1:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * int(radius) + 1, 2 * int(radius) + 1))
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k)
    return m, q


def square_completion(piece, shape):
    """Assume a (rounded) square swatch: grow the visible part's minAreaRect to a square."""
    ys, xs = np.nonzero(piece)
    pts = np.stack([xs, ys], 1).astype(np.float32)
    (cx, cy), (w, h), ang = cv2.minAreaRect(pts)
    side = max(w, h)
    return (cx, cy), (w, h), ang, side


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--background", default=os.path.join(HERE, "ad-background.jpg"))
    ap.add_argument("--out", default=os.path.join(HERE, "layers"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for f in os.listdir(a.out):
        if f.endswith(".png") or f.endswith(".json"):
            os.remove(os.path.join(a.out, f))

    # Work at the still's scale: crop to 4:5 and Lanczos-upscale to 2160x2700
    src = Image.open(a.background).convert("RGB")
    W0, H0 = src.size
    cw, ch = (H0 * OUT_W / OUT_H, H0) if W0 / H0 > OUT_W / OUT_H else (W0, W0 * OUT_H / OUT_W)
    x0, y0 = (W0 - cw) / 2, (H0 - ch) / 2
    scale = OUT_W / cw
    img = np.asarray(src.crop((x0, y0, x0 + cw, y0 + ch)).resize((OUT_W, OUT_H), Image.LANCZOS))
    H, W = img.shape[:2]
    f = img.astype(np.float32)

    # 1. Background plate
    teal = teal_mask(img)
    fg0 = cv2.morphologyEx((~teal).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    bgsafe = cv2.erode((fg0 == 0).astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
    model = fit_plate(f, bgsafe)
    resid = f - model
    hole = (~bgsafe).astype(np.uint8)
    small = cv2.resize(np.clip(resid + 128, 0, 255).astype(np.uint8), (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    hole_s = cv2.resize(hole * 255, (W // 4, H // 4), interpolation=cv2.INTER_NEAREST)
    filled = cv2.inpaint(small, hole_s, 9, cv2.INPAINT_TELEA)
    filled = cv2.GaussianBlur(filled, (0, 0), 28)  # soft glow, no object-shaped patches
    resid_fill = cv2.resize(filled, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32) - 128
    # objects leave faint halos/shadows on the teal: replace a generous margin round them too
    hole_wide = cv2.dilate(hole, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61)))
    soft = cv2.GaussianBlur(hole_wide.astype(np.float32), (0, 0), 12)[..., None]
    plate = np.clip(f * (1 - soft) + (model + resid_fill) * soft, 0, 255)
    print("plate: polynomial fit + inpainted detail; max residual on teal %.1f" % np.abs(resid[bgsafe]).max())

    # 2. Soft alpha from the difference to the plate
    d = np.sqrt(((f - plate) ** 2).sum(2))
    alpha = np.clip((d - 10) / 30, 0, 1)
    fg = cv2.morphologyEx((d > 22).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))

    # 3. Phone: screen outline pushed out to the frame edge
    corners0, _ = find_screen(np.asarray(src)[..., ::-1].copy())
    quad = (corners0 + 0.5 - [x0, y0]) * scale - 0.5
    # How far the bezel + metal frame extends past each screen edge: walk outward
    # over "phone-coloured" pixels (dark bezel, or bluish-grey metal) and stop at
    # anything else (teal background, white cloud, brown/beige swatches).
    frame_like = (fg > 0) & ((f[..., 2] >= f[..., 0] + 4) | (f.max(2) < 85)) & ~(f.min(2) > 215)
    teal_strict = teal & (np.abs(f - plate).sum(2) < 25)
    frame_like &= ~teal_strict
    offs = []
    for i in range(4):
        a_, b_ = quad[i], quad[(i + 1) % 4]
        u = (b_ - a_) / np.linalg.norm(b_ - a_)
        n = np.array([-u[1], u[0]])
        if n @ ((a_ + b_) / 2 - quad.mean(0)) < 0:
            n = -n
        runs = []
        for t in np.linspace(0.15, 0.85, 41):
            p = a_ + (b_ - a_) * t
            k, miss = 0, 0
            while k < 160:
                x, y = (p + n * (k + 1)).round().astype(int)
                if not (0 <= x < W and 0 <= y < H):
                    break
                if frame_like[y, x]:
                    miss = 0
                else:
                    miss += 1
                    if miss > 2:
                        k -= 2
                        break
                k += 1
            runs.append(k)
        offs.append(float(np.percentile(runs, 60)))
    print("raw frame widths per side (top, right, bottom, left):", [round(o, 1) for o in offs])
    med = float(np.median(offs))
    offs = [min(max(o, med * 0.5), med * 2.2) for o in offs]
    phone_m, phone_q = rounded_quad_mask((H, W), quad, [o + 2 for o in offs], radius=float(np.median(offs)) * 2.6 + 40)
    phone_soft = None
    try:
        from rembg import remove, new_session
        um = remove(src, session=new_session("u2net"), only_mask=True)  # at the original size
        um = um.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.LANCZOS)
        um = np.asarray(um).astype(np.float32) / 255
        # keep the part connected to the screen
        nn, ll = cv2.connectedComponents((um > 0.5).astype(np.uint8), 8)
        sid = ll[int(quad[:, 1].mean()), int(quad[:, 0].mean())]
        keep = cv2.dilate((ll == sid).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        phone_soft = np.where(keep, um, 0)
        # u2net leaves out the visible side of the metal frame; the geometric
        # outline (screen edges pushed out by the measured frame width) covers it
        geo = cv2.GaussianBlur((phone_m > 127).astype(np.float32), (0, 0), 1)
        phone_soft = np.maximum(phone_soft, geo)
        phone_m = (phone_soft > 0.5).astype(np.uint8) * 255
        print("phone outline: rembg u2net")
    except Exception as e:  # noqa: BLE001
        print("phone outline: geometric (rembg unavailable: %s)" % e)
    phone = phone_m > 127
    print("phone frame offsets (px):", [round(o, 1) for o in offs])

    # Side buttons: bluish frame-coloured pixels just outside the phone outline
    ring = cv2.dilate(phone_m, np.ones((31, 31), np.uint8)) > 0
    bluish = (f[..., 2] > f[..., 0] + 25) & (f[..., 2] > 120) & ~teal
    # left edge of the phone (side buttons live there)
    la, lb = phone_q[3], phone_q[0]
    lu = (lb - la) / np.linalg.norm(lb - la)
    gy, gx = np.mgrid[0:H, 0:W]
    dist_left = np.abs((gx - la[0]) * -lu[1] + (gy - la[1]) * lu[0])
    buttons = ring & ~phone & bluish & (fg > 0) & (dist_left < 30)
    buttons = cv2.morphologyEx(buttons.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0

    # 4. Objects = connected parts of the foreground outside the phone
    # leave a small gap round the phone so the thin rim left between the phone's
    # matte and the foreground doesn't join everything that touches the phone
    phone_gap = cv2.dilate(phone_m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))) > 0
    objs = (fg > 0) & ~phone_gap & ~buttons
    raw_fg = d > 22  # before closing: keeps the points of the stars, for shape tests
    n, lab, st, cen = cv2.connectedComponentsWithStats(objs.astype(np.uint8), 8)
    # Overlapping swatches come out as one part: split them where the shape has
    # more than one "core" (distance-transform peaks), with a watershed.
    nxt = n
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 20000:
            continue
        piece = (lab == i).astype(np.uint8)
        dist = cv2.distanceTransform(piece, cv2.DIST_L2, 5)
        # each square's centre is a local peak of the distance map; small peaks
        # (corners, notches) are ignored
        peak = (dist >= cv2.dilate(dist, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61)))) & (dist > 0.45 * dist.max())
        k0, pl = cv2.connectedComponents(peak.astype(np.uint8), 8)
        cores = np.zeros((H, W), np.uint8)
        for c in range(1, k0):
            v = dist[pl == c].max()
            cores |= ((dist > 0.8 * v) & (cv2.connectedComponents(((dist > 0.8 * v) & (piece > 0)).astype(np.uint8), 8)[1] ==
                      cv2.connectedComponents(((dist > 0.8 * v) & (piece > 0)).astype(np.uint8), 8)[1][pl == c][0])).astype(np.uint8)
        k, cl = cv2.connectedComponents(cores, 8)
        if k <= 2 or st[i, cv2.CC_STAT_AREA] > 300000:  # one core, or the cloud
            continue
        markers = np.zeros((H, W), np.int32)
        markers[piece == 0] = 1
        for c in range(1, k):
            markers[cl == c] = 1 + c
        # assign each pixel to the core it's closest to in colour (Lab), then tidy up
        lab_img = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)
        means = [lab_img[cl == c].mean(0) for c in range(1, k)]
        pidx = piece > 0
        dists = np.stack([np.linalg.norm(lab_img[pidx] - m_, axis=1) for m_ in means], 1)
        assign = np.zeros((H, W), np.int32)
        assign[pidx] = 1 + np.argmin(dists, 1)
        ws = np.zeros((H, W), np.int32)
        ell = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
        for c in range(1, k):
            r_ = cv2.morphologyEx((assign == c).astype(np.uint8), cv2.MORPH_OPEN, ell)  # drops thin rims
            r_ = cv2.morphologyEx(r_, cv2.MORPH_CLOSE, ell)
            nn, ll, ss, _ = cv2.connectedComponentsWithStats(r_, 8)
            if nn > 1:
                ws[(ll == 1 + int(np.argmax(ss[1:, 4]))) & pidx] = 1 + c
        # each part's convex hull (swatches are convex); overlaps go to the part that owns more of them
        hulls = []
        for c in range(1, k):
            hm = np.zeros((H, W), np.uint8)
            cs, _ = cv2.findContours((ws == 1 + c).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if cs:
                cv2.fillPoly(hm, [cv2.convexHull(max(cs, key=cv2.contourArea))], 1)
            hulls.append((hm > 0) & (piece > 0))
        ws2 = np.zeros((H, W), np.int32)
        for c in range(1, k):
            ws2[hulls[c - 1]] = 1 + c
        # the tile in front is the most complete (convex) one: it keeps its whole hull, rim included
        sol = []
        for c in range(1, k):
            rr = (ws == 1 + c).astype(np.uint8)
            sol.append(rr.sum() / max(hulls[c - 1].sum(), 1))
        front = int(np.argmax(sol))
        fh = cv2.dilate(hulls[front].astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))) > 0
        ws2 = np.zeros((H, W), np.int32)
        rest = (piece > 0) & ~fh
        nn, ll, ss, _ = cv2.connectedComponentsWithStats(cv2.morphologyEx(rest.astype(np.uint8), cv2.MORPH_OPEN, ell), 8)
        ws2[fh & (piece > 0)] = 2 + front
        others = [c for c in range(1, k) if c - 1 != front]
        if nn > 1 and others:
            ws2[(ll == 1 + int(np.argmax(ss[1:, 4]))) & rest] = 1 + others[0]
        ws = ws2
        for c in range(1, k):
            region = (ws == 1 + c) & (piece > 0)
            lab[region] = nxt if c > 1 else i
            if c > 1:
                nxt += 1
        print("split one part into %d swatches" % (k - 1))
    n = nxt
    st = np.zeros((n, 5), np.int64)
    for i in range(1, n):
        ys, xs = np.nonzero(lab == i)
        if len(xs):
            st[i] = [xs.min(), ys.min(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1, len(xs)]
    layers = []
    phone_ref = np.array([[209, 236, 253], [20, 20, 22], [150, 185, 215]], np.float32)  # screen, bezel, frame
    near_phone = cv2.dilate(phone_m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (51, 51))) > 0
    for i in range(1, n):
        area = st[i, cv2.CC_STAT_AREA]
        if area < 120:
            continue
        piece = lab == i
        mean = f[piece].mean(0)
        x, y, w, h = st[i, :4]
        touches = (piece & near_phone).any()
        whiteish = mean.min() > 200
        pts = np.stack(np.nonzero(piece)[::-1], 1).astype(np.float32)
        (_, _), (rw, rh), _ = cv2.minAreaRect(pts)
        cnts_, _ = cv2.findContours((piece & raw_fg).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        big_c = max(cnts_, key=cv2.contourArea)
        fill = cv2.contourArea(big_c) / max(cv2.contourArea(cv2.convexHull(big_c)), 1)  # solidity: star ~0.6, dot/square ~0.97
        if min(rw, rh) < 0.3 * max(rw, rh) and not whiteish:
            continue  # thin sliver (edge of the phone frame): belongs to the phone
        if area > 150000 and whiteish:
            kind = "cloud"
        elif area < 12000:
            core = cv2.erode(piece.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
            cm = f[core].mean(0) if core.any() else mean
            pink = cm[0] - cm[1] > 45  # pink dots; the stars are cream or pink-but-pointy
            if not pink and cm[2] > cm[0] + 5:
                continue  # bluish-grey fragment of the phone frame (stars are cream or pink)
            kind = "dot" if (pink and fill > 0.9) else "sparkle"
        else:
            kind = "swatch"
        layers.append(dict(kind=kind, mask=piece, touches=bool(touches), mean=mean, area=int(area)))
        if os.environ.get("LAYERS_DEBUG"):
            print("  part", i, kind, "area", area, "fill %.2f" % fill, "box", (x, y, w, h), "touches phone", bool(touches))

    # give the gap pixels back to the object they belong to (fg, outside the phone matte)
    gap = phone_gap & ~phone & (fg > 0)
    if layers:
        lblm = np.zeros((H, W), np.int32)
        for k_, L in enumerate(layers):
            lblm[L["mask"]] = k_ + 1
        _, near = cv2.distanceTransformWithLabels((lblm == 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        ys_, xs_ = np.nonzero(lblm)
        lut = np.zeros(near.max() + 1, np.int32)
        lut[near[ys_, xs_]] = lblm[ys_, xs_]
        owner = lut[near]
        dist_obj = cv2.distanceTransform((lblm == 0).astype(np.uint8), cv2.DIST_L2, 5)
        silver = (f[..., 2] >= f[..., 0] + 4) | (f.max(2) < 85)  # phone frame metal / bezel
        for k_, L in enumerate(layers):
            if L["kind"] in ("swatch", "cloud"):
                cand = gap & (owner == k_ + 1) & (dist_obj < 12)
                if L["kind"] == "cloud" or L["mean"][0] > L["mean"][2] + 10:  # warm/white objects: drop silver pixels
                    cand &= ~silver
                L["mask"] = L["mask"] | cand
        gap_left = gap.copy()
        for L in layers:
            gap_left &= ~L["mask"]
    else:
        gap_left = gap

    # Front or behind the phone, and completing hidden parts
    phone_final = phone | buttons
    for L in layers:
        L["z"] = "behind_phone" if L["kind"] == "cloud" else "front"
        L["extra"] = np.zeros((H, W), bool)
        if not L["touches"] or L["kind"] in ("dot", "sparkle"):
            continue
        if L["kind"] == "swatch":
            (cx, cy), (w, h), ang, side = square_completion(L["mask"], (H, W))
            if any(np.linalg.norm(np.array([cx / W, cy / H]) - np.array(q_)) < 0.025 for q_ in FRONT_OF_PHONE_NEAR):
                L["z"] = "front_of_phone"
                phone_final &= ~cv2.dilate(L["mask"].astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
                print("swatch touching phone at (%.2f, %.2f): front_of_phone (override)" % (cx / W, cy / H))
                continue
            if min(w, h) > 0.975 * side:
                # looks whole, but may still be cut across a corner: rebuild a band under the phone edge
                L["z"] = "behind_phone"
                L["extra"] = (cv2.dilate(L["mask"].astype(np.uint8), np.ones((81, 81), np.uint8)) > 0) & phone & ~L["mask"]
                print("swatch touching phone at (%.2f, %.2f): behind_phone (band rebuilt)" % (cx / W, cy / H))
                continue
            # grow the rect to a square, towards the phone
            rect = cv2.boxPoints(((cx, cy), (w, h), ang))
            pc = np.array(np.nonzero(phone)[::-1]).mean(1)
            axis = (rect[1] - rect[0]) if w < h else (rect[2] - rect[1])
            axis = axis / np.linalg.norm(axis)
            short = min(w, h)
            shift = (side - short) / 2 * (1 if axis @ (pc - [cx, cy]) > 0 else -1)
            sq = ((cx + axis[0] * shift, cy + axis[1] * shift), (side, side), ang)
            sqm = np.zeros((H, W), np.uint8)
            cv2.fillPoly(sqm, [np.round(cv2.boxPoints(sq) * 8).astype(np.int32)], 255, lineType=cv2.LINE_AA, shift=3)
            r = int(side * 0.14)
            sqm = cv2.morphologyEx(sqm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
            band = cv2.dilate(L["mask"].astype(np.uint8), np.ones((81, 81), np.uint8)) > 0
            hidden = (sqm > 127) & phone & ~L["mask"] & band
            if hidden.sum() < 50:
                continue
            ys_, xs_ = np.nonzero(L["mask"])
            cxy = np.array([xs_.mean() / W, ys_.mean() / H])
            if any(np.linalg.norm(cxy - np.array(q_)) < 0.025 for q_ in FRONT_OF_PHONE_NEAR):
                L["z"] = "front_of_phone"
                phone_final &= ~cv2.dilate(L["mask"].astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
            else:
                L["z"] = "behind_phone"
                L["extra"] = hidden
            print("swatch touching phone at (%.2f, %.2f): %s" % (cxy[0], cxy[1], L["z"]))
        elif L["kind"] == "cloud":
            # a band of plain cloud behind the phone, so a small movement shows no cut edge
            band = cv2.dilate(L["mask"].astype(np.uint8), np.ones((81, 81), np.uint8)) > 0
            L["extra"] = band & phone & ~L["mask"]
            print("cloud: %d px rebuilt behind the phone" % L["extra"].sum())

    # Build RGBA layers (straight alpha), cropped to their boxes
    out_layers = []
    def save(name, rgb, al, kind, z, order):
        ys, xs = np.nonzero(al > 0.004)
        if len(xs) == 0:
            return
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        rgba = np.dstack([np.clip(rgb[by0:by1, bx0:bx1], 0, 255), al[by0:by1, bx0:bx1] * 255]).astype(np.uint8)
        Image.fromarray(rgba, "RGBA").save(os.path.join(a.out, name + ".png"), optimize=True)
        out_layers.append(dict(name=name, file=name + ".png", kind=kind, z=z, order=order, x=int(bx0), y=int(by0), w=int(bx1 - bx0), h=int(by1 - by0),
                               cx=float((bx0 + bx1) / 2), cy=float((by0 + by1) / 2), area=int((al > 0.5).sum())))

    def unpremult(al, region):
        # foreground colour F from I = a*F + (1-a)*plate
        a3 = np.maximum(al, 0.02)[..., None]
        F = (f - (1 - a3) * plate) / a3
        return np.where(region[..., None], F, f)

    counters = {"swatch": 0, "sparkle": 0, "dot": 0}
    # sort: biggest first so numbering is stable-ish (left to right within kind)
    layers.sort(key=lambda L: (L["kind"], float(np.nonzero(L["mask"])[1].mean())))
    owner_all = np.zeros((H, W), np.int32)
    for k_, L in enumerate(layers):
        owner_all[L["mask"]] = k_ + 1
    for k_, L in enumerate(layers):
        # soft edge, but never into pixels another layer owns
        grow = (cv2.dilate(L["mask"].astype(np.uint8), np.ones((7, 7), np.uint8)) > 0) & ((owner_all == 0) | (owner_all == k_ + 1))
        al = np.where(grow, alpha, 0).astype(np.float32)
        al[cv2.erode(L["mask"].astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = 1
        rgb = unpremult(al, grow)
        if L["z"] == "front_of_phone":
            al[L["mask"]] = 1
        if L["extra"].any():
            ex = L["extra"] & ~L["mask"]
            src_m = L["mask"].copy()
            if L["kind"] == "cloud" or L["mean"][0] > L["mean"][2] + 10:
                src_m &= ~((f[..., 2] >= f[..., 0] + 4) & cv2.dilate(phone_m, np.ones((41, 41), np.uint8)).astype(bool))
            if L["kind"] == "cloud":
                # plain body colour only (no eyes, mouth, cheeks): drop dark/pink pixels as sources
                feat = (f.min(2) < 170) | (f[..., 0] - f[..., 1] > 25)
                src_m &= ~cv2.dilate(feat.astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool)
            # nearest visible pixel of the object, for every hidden pixel
            _, lbl = cv2.distanceTransformWithLabels((~src_m).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
            ys, xs = np.nonzero(src_m)
            lut = np.zeros((lbl.max() + 1, 3), np.float32)
            lut[lbl[ys, xs]] = rgb[ys, xs]
            fill = lut[lbl]
            fill = cv2.GaussianBlur(fill, (0, 0), 10 if L["kind"] == "cloud" else 3)
            rgb = np.where(ex[..., None], fill, rgb)
            al = np.maximum(al, cv2.GaussianBlur(ex.astype(np.float32), (0, 0), 1.2))
        kind = L["kind"]
        if kind == "cloud":
            name = "cloud"
        else:
            counters[kind] += 1
            name = "%s-%02d" % (kind, counters[kind])
        order = {"behind_phone": 1, "front": 3, "front_of_phone": 4}[L["z"]]
        save(name, rgb, al, kind, L["z"], order)

    # phone layer (includes the screen; screen content is composited onto it later)
    if phone_soft is not None:
        pa = np.where(phone_final | (phone_soft > 0.02) & ~cv2.dilate(np.any([L["mask"] for L in layers if L["z"] == "front_of_phone"] or [np.zeros((H, W), bool)], 0).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool), phone_soft, 0).astype(np.float32)
        pa[cv2.erode(phone_final.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = 1
        pa = np.maximum(pa, np.where(gap_left, alpha, 0))  # the silver rim just outside the matte
    else:
        pa = cv2.GaussianBlur(phone_final.astype(np.float32), (0, 0), 0.8)
        pa = np.maximum(pa, (phone_final & (alpha > 0.9)).astype(np.float32))
    save("phone", f, pa, "phone", "phone", 2)
    Image.fromarray(plate.astype(np.uint8)).save(os.path.join(a.out, "plate.png"), optimize=True)

    meta = dict(width=W, height=H, scale_from_original=scale, crop_offset=[x0, y0],
                screen_corners=quad.tolist(), layers=sorted(out_layers, key=lambda d: (d["order"], -d["area"])))
    with open(os.path.join(a.out, "layers.json"), "w") as fh:
        json.dump(meta, fh, indent=1)
    kinds = {}
    for L in out_layers:
        kinds[L["kind"]] = kinds.get(L["kind"], 0) + 1
    print("layers:", kinds)

    # Re-assemble to check nothing was lost
    canvas = plate.copy()
    for L in meta["layers"]:
        im = np.asarray(Image.open(os.path.join(a.out, L["file"]))).astype(np.float32)
        al = im[..., 3:] / 255
        sl = canvas[L["y"]:L["y"] + L["h"], L["x"]:L["x"] + L["w"]]
        sl[:] = sl * (1 - al) + im[..., :3] * al
    err = np.abs(canvas - f).mean(2)
    print("re-assembly vs original: mean diff %.2f, 99th pct %.1f" % (err.mean(), np.percentile(err, 99)))
    Image.fromarray(canvas.astype(np.uint8)).resize((W // 2, H // 2), Image.LANCZOS).save(os.path.join(a.out, "check-reassembled.png"))

    # Contact sheet on a checkerboard
    tiles = [("plate", plate.astype(np.uint8))]
    for L in meta["layers"]:
        tiles.append((L["name"] + " (" + L["z"].replace("_", " ") + ")", np.asarray(Image.open(os.path.join(a.out, L["file"])))))
    cell, cols = 300, 6
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 24)), "white")
    dr = ImageDraw.Draw(sheet)
    for k, (name, arr) in enumerate(tiles):
        im = Image.fromarray(arr)
        im.thumbnail((cell - 12, cell - 12))
        bgc = Image.new("RGB", (cell - 4, cell - 4))
        d2 = ImageDraw.Draw(bgc)
        for yy in range(0, cell, 16):
            for xx in range(0, cell, 16):
                d2.rectangle([xx, yy, xx + 15, yy + 15], fill=(255, 255, 255) if (xx // 16 + yy // 16) % 2 else (205, 205, 205))
        bgc.paste(im, ((cell - 4 - im.width) // 2, (cell - 4 - im.height) // 2), im if im.mode == "RGBA" else None)
        cx_, cy_ = (k % cols) * cell, (k // cols) * (cell + 24)
        sheet.paste(bgc, (cx_ + 2, cy_ + 22))
        dr.text((cx_ + 6, cy_ + 4), name, fill=(1, 61, 63))
    sheet.save(os.path.join(a.out, "contact-sheet.png"))
    print("saved", a.out)


if __name__ == "__main__":
    main()
