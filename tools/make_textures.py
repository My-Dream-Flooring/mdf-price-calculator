"""Build seamless 1024px tiles + 160px thumbnails from textures/source/*.png.

Usage (from repo root):  python3 tools/make_textures.py [--compare OUTDIR]
Needs Pillow + numpy. Each source has rounded transparent corners and uneven
studio lighting, so every image is cropped inside the opaque area and its
lighting is flattened (smooth quadratic fit) before tiling.
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "textures", "source")
OUT = os.path.join(ROOT, "textures")

# name -> (source file, method, crop box (x, y, w, h) inside the 700px source)
#   mirror : mirrored 2x2 tile of the crop
#   blend  : crop + overlap band; opposite edges cross-faded (offset-and-blend)
#   seam   : crop + overlap band; opposite edges joined along the path where they
#            match best (minimum-error cut), so random pile/grain stays sharp
# For the patterned floors the crop is exactly one measured pattern repeat, so
# the geometry lines up and only the grain/print is blended in the overlap band.
# Mirrored 2x2 was tried first for all five; it visibly broke every one
# (kaleidoscope crosses on the carpets, wrong herringbone/pattern geometry,
# mirrored knots on the laminate), so none use it.
TEXTURES = {
    "westminster": ("Westminster-Mid-Grey.png", "seam", (60, 60, 490, 490)),
    "buckingham":  ("Buckingham-Mist.png", "seam", (20, 20, 600, 600)),
    "expressions": ("Cedar-Grey-Herringbone-EX11.png", "blend", (30, 30, 597, 597)),  # 4 herringbone repeats
    "balmoral":    ("Pop-Art-9003.png", "seam", (26, 26, 450, 596)),                 # 1 design repeat (not square)
    "laminate":    ("Laminate-Atlas.png", "blend", (40, 40, 580, 580)),
}
BAND = 48  # overlap band (px, source scale) for the blend method
# Distance (px) from the source edge that is fully opaque and clear of the
# rounded corners. Crops (plus any overlap band) must stay inside this.
# Per-texture overrides: overlap band width and carpet flattening strength.
BAND_FOR = {"westminster": 96}
FLAT_SIGMA = {"westminster": 14, "buckingham": 45}
SAFE = {"westminster": 50, "buckingham": 4, "expressions": 22, "balmoral": 20, "laminate": 36}


def load(fname):
    return np.array(Image.open(os.path.join(SRC, fname)).convert("RGB")).astype(np.float64)


def flatten_lighting(a, region, mask_bright=False):  # noqa: C901
    """Divide out a smooth quadratic lighting surface fitted to log luminance."""
    x0, y0, x1, y1 = region
    sub = a[y0:y1, x0:x1]
    lum = np.array(Image.fromarray(sub.mean(2).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float) + 1
    H, W = lum.shape
    yy, xx = np.mgrid[0:H, 0:W]
    xn, yn = xx / W - 0.5, yy / H - 0.5
    A = np.stack([np.ones_like(xn), xn, yn, xn * xn, yn * yn, xn * yn], -1).reshape(-1, 6)
    sel = np.ones(H * W, bool) if not mask_bright else (lum.ravel() > np.percentile(lum, 60))
    coef, *_ = np.linalg.lstsq(A[sel], np.log(lum.ravel()[sel]), rcond=None)
    # evaluate on the full source grid, normalised to the same coordinates
    fy, fx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    fxn, fyn = (fx - x0) / W - 0.5, (fy - y0) / H - 0.5
    surf = coef[0] + coef[1] * fxn + coef[2] * fyn + coef[3] * fxn ** 2 + coef[4] * fyn ** 2 + coef[5] * fxn * fyn
    gain = np.exp(coef[0] - surf)[..., None]
    return np.clip(a * gain, 0, 255)


def flatten_local(a, sigma=45):
    """Stronger flattening for random pile: divide by a heavy blur of luminance."""
    lum = a.mean(2)
    blur = np.array(Image.fromarray(np.clip(lum, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(sigma))).astype(float) + 1
    inner = blur[100:600, 100:600].mean()
    return np.clip(a * (inner / blur)[..., None], 0, 255)


def _gblur(x, sigma):
    """Gaussian blur of a float array (any range) via Pillow, in 0..255 steps."""
    lo, hi = float(x.min()), float(x.max())
    span = hi - lo or 1.0
    img = Image.fromarray(((x - lo) / span * 255).astype(np.uint8))
    return np.array(img.filter(ImageFilter.GaussianBlur(sigma))).astype(float) / 255 * span + lo


def flatten_two_tone(a, sigma=18):
    """For black/white prints: even out each tone separately (removes the
    reflection on the black stripes in the Pop Art photo)."""
    lum = a.mean(2)
    dark = np.clip((150 - lum) / 40, 0, 1)  # soft mask: 1 = black ink, 0 = white
    out = a.copy()
    for m in (dark, 1 - dark):
        wsum = _gblur(m, sigma) + 1e-3
        local = np.stack([_gblur(a[..., c] * m, sigma) for c in range(3)], -1) / wsum[..., None]
        target = (a * m[..., None]).sum((0, 1)) / m.sum()
        gain = np.clip(target / np.maximum(local, 1), 0.3, 3)
        out = out * (1 - m[..., None]) + a * gain * m[..., None]
    return np.clip(out, 0, 255)


def mirror_tile(a, box):
    x, y, w, h = box
    c = a[y:y + h, x:x + w]
    top = np.concatenate([c, c[:, ::-1]], 1)
    return np.concatenate([top, top[::-1]], 0)


def blend_tile(a, box, band=BAND):
    """Crop w x h plus a band of continuation; cross-fade the band onto the start."""
    x, y, w, h = box
    e = a[y:y + h + band, x:x + w + band].copy()
    t = np.linspace(0, 1, band)[None, :, None]  # 0 at the seam edge, 1 inside
    e[:, :band] = e[:, :band] * t + e[:, w:w + band] * (1 - t)
    e = e[:, :w]
    t = np.linspace(0, 1, band)[:, None, None]
    e[:band] = e[:band] * t + e[h:h + band] * (1 - t)
    return e[:h]


def _min_cut(diff):
    """Vertical path (one column index per row) through diff with least total cost."""
    H, W = diff.shape
    cost = diff.copy()
    for y in range(1, H):
        prev = cost[y - 1]
        left = np.r_[np.inf, prev[:-1]]
        right = np.r_[prev[1:], np.inf]
        cost[y] += np.minimum(np.minimum(left, prev), right)
    path = np.zeros(H, int)
    path[-1] = int(np.argmin(cost[-1]))
    for y in range(H - 2, -1, -1):
        x = path[y + 1]
        lo, hi = max(0, x - 1), min(W, x + 2)
        path[y] = lo + int(np.argmin(cost[y, lo:hi]))
    return path


def _seam_cols(e, w, band, feather=2.0):
    """Join columns: output[:, :band] goes from the continuation (left of cut) to the start (right of cut)."""
    L, R = e[:, :band], e[:, w:w + band]
    path = _min_cut(((L - R) ** 2).sum(2))
    xs = np.arange(band)[None, :]
    m = np.clip((xs - path[:, None]) / feather + 0.5, 0, 1)[..., None]  # 0 left of cut -> R, 1 right -> L
    out = e[:, :w].copy()
    out[:, :band] = R * (1 - m) + L * m
    return out


def seam_tile(a, box, band=BAND):
    x, y, w, h = box
    e = a[y:y + h + band, x:x + w + band]
    e = _seam_cols(e, w, band)                     # left/right wrap
    e = _seam_cols(e.transpose(1, 0, 2), h, band)  # top/bottom wrap
    return e.transpose(1, 0, 2)


def to_img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def build(name, method=None):
    fname, default_method, box = TEXTURES[name]
    method = method or default_method
    a = load(fname)
    x, y, w, h = box
    band = BAND_FOR.get(name, BAND)
    pad = band if method in ("blend", "seam") else 0
    limit = 700 - SAFE[name]
    if x + w + pad > limit or y + h + pad > limit:
        if name in ("expressions", "balmoral"):
            raise ValueError(name + ": pattern-repeat crop does not fit")
        w = h = min(limit - x, limit - y) - pad  # shrink plain textures to fit
        box = (x, y, w, h)
    if name in ("westminster", "buckingham"):
        a = flatten_local(a, FLAT_SIGMA[name])
    elif name == "balmoral":  # two-tone print: even each tone, removes the photo's reflection
        a = flatten_two_tone(a)
    else:
        a = flatten_lighting(a, (x, y, x + w + pad, y + h + pad))
    if method == "mirror":
        tile = mirror_tile(a, box)
    else:
        tile = (blend_tile if method == "blend" else seam_tile)(a, box, band)
    return to_img(tile).resize((1024, 1024), Image.LANCZOS)


def thumb(name):
    """160px square thumbnail from the original (cropped inside the rounded corners)."""
    fname = TEXTURES[name][0]
    im = Image.open(os.path.join(SRC, fname)).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    k = SAFE[name] + 4
    im = Image.alpha_composite(bg, im).convert("RGB").crop((k, k, 700 - k, 700 - k))
    return im.resize((160, 160), Image.LANCZOS)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--compare":
        out = sys.argv[2]
        os.makedirs(out, exist_ok=True)
        for n in TEXTURES:
            for m in ("mirror", "blend", "seam"):
                t = build(n, m).resize((512, 512), Image.LANCZOS)
                rep = Image.new("RGB", (1024, 1024))
                for i in range(2):
                    for j in range(2):
                        rep.paste(t, (i * 512, j * 512))
                rep.save(os.path.join(out, f"{n}-{m}-2x2.jpg"), quality=85)
        sys.exit()
    for n in TEXTURES:
        build(n).save(os.path.join(OUT, f"{n}.jpg"), quality=80, optimize=True, progressive=True)
        thumb(n).save(os.path.join(OUT, f"{n}-thumb.jpg"), quality=82, optimize=True)
        print("wrote", n)
