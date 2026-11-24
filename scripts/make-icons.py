"""Generate KnowThings app icons (radar mark) with Pillow. Run: python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'app', 'icons')
S = 1024  # draw large, downscale for crisp edges


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make(safe=1.0):
    img = Image.new('RGB', (S, S))
    top, bottom = (20, 18, 48), (8, 10, 20)
    px = img.load()
    for y in range(S):
        c = lerp(top, bottom, y / S)
        for x in range(S):
            px[x, y] = c
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = S / 2, S / 2 + 40 * safe
    gd.ellipse([cx - 360 * safe, cy - 360 * safe, cx + 360 * safe, cy + 360 * safe], fill=(110, 90, 255, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img.paste(glow, (0, 0), glow)
    d = ImageDraw.Draw(img, 'RGBA')
    # radar rings
    for r, a in [(330, 90), (230, 140), (130, 200)]:
        r *= safe
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(150, 170, 255, a), width=int(18 * safe))
    # sweep wedge
    R = 330 * safe
    for i in range(60):
        ang = -60 + i
        a = int(3 + i * 2.4)
        d.pieslice([cx - R, cy - R, cx + R, cy + R], ang, ang + 1.5, fill=(63, 208, 230, a))
    # sweep line
    ang = math.radians(0)
    d.line([cx, cy, cx + R * math.cos(ang), cy + R * math.sin(ang)], fill=(120, 235, 250, 255), width=int(16 * safe))
    # blips
    for bx, by, br in [(0.55, -0.42, 34), (-0.5, 0.3, 26), (0.2, 0.62, 22)]:
        x, y, rr = cx + bx * R, cy + by * R, br * safe
        d.ellipse([x - rr * 2, y - rr * 2, x + rr * 2, y + rr * 2], fill=(139, 125, 255, 60))
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(235, 240, 255, 255))
    d.ellipse([cx - 30 * safe, cy - 30 * safe, cx + 30 * safe, cy + 30 * safe], fill=(255, 255, 255, 255))
    return img


os.makedirs(OUT, exist_ok=True)
full = make(1.0)
for name, size in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)]:
    full.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
make(0.78).resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-maskable-512.png'), optimize=True)
print('icons written to', os.path.normpath(OUT))
