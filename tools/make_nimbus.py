"""Build the Nimbus guide images from images/source.

Usage (from repo root):  python3 tools/make_nimbus.py
Each pick is trimmed to the character (its transparent edges removed), then
saved as WebP with transparency at 2x (max 300px wide) and 1x (max 150px wide).
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "images", "source")
OUT = os.path.join(ROOT, "images")

PICKS = {
    "wave": "Nimbus-1-e1783957659525.png",   # smiling, holding a carpet sample
    "think": "Nimbus-2-3.png",                # lying down, chin on hand
    "point": "Nimbus-2-5.png",                # arm raised, pointing
    "celebrate": "Nimbus-2-8.png",            # arms up with confetti
}

for role, fname in PICKS.items():
    im = Image.open(os.path.join(SRC, fname)).convert("RGBA")
    alpha = im.split()[3].point(lambda v: 255 if v > 8 else 0)  # ignore faint stray pixels
    im = im.crop(alpha.getbbox())
    for suffix, maxw in (("@2x", 300), ("", 150)):
        out = im.copy()
        if out.width > maxw:
            out = out.resize((maxw, round(out.height * maxw / out.width)), Image.LANCZOS)
        path = os.path.join(OUT, "nimbus-%s%s.webp" % (role, suffix))
        out.save(path, "WEBP", quality=88, method=6)
        print("wrote", os.path.relpath(path, ROOT), out.size)
