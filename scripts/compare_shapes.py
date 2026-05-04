"""Side-by-side: forest vs water — vizuálně + měřeně diamond shape."""
import sys
from PIL import Image, ImageDraw
import numpy as np
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
TERRAIN = ROOT / 'public' / 'assets' / 'terrain'

names = ['water', 'forest', 'mountain', 'wetlands', 'grass', 'farmland']

# Vykreslíme každou dlaždici 2× — original + s overlayem expected diamond outline.
# Expected diamond: top corner v (W/2, 0), levá špička (0, H/2_expected),
# bottom (W/2, H_expected), pravá špička (W-1, H/2_expected).
# H_expected = TILE_H = 64 (= 2 × HALF_H = 2 × 32 z iso.ts).

TILE_H_EXPECTED = 64

cells = []
for name in names:
    p = TERRAIN / f'{name}01.png'
    if not p.exists():
        continue
    im = Image.open(p).convert('RGBA')
    arr = np.array(im)
    alpha = arr[..., 3]
    H, W = alpha.shape

    # Měření per řádek (debug profile)
    widths = (alpha > 0).sum(axis=1)

    # Original + overlay
    overlay = im.copy()
    draw = ImageDraw.Draw(overlay)
    # Expected diamond outline (red)
    draw.polygon(
        [(W // 2, 0), (W - 1, TILE_H_EXPECTED // 2), (W // 2, TILE_H_EXPECTED), (0, TILE_H_EXPECTED // 2)],
        outline=(255, 0, 64, 255), width=2,
    )
    # Měřená levá špička (col-x=0 first alpha) — green dot
    edge_tops = []
    for x in range(5):
        col = alpha[:, x]
        positive = np.where(col > 0)[0]
        if len(positive) > 0:
            edge_tops.append(int(positive[0]))
    if edge_tops:
        y_left = min(edge_tops)
        draw.ellipse([(0, y_left - 3), (6, y_left + 3)], fill=(0, 255, 0, 255))

    # Top alpha row width info do label
    label = f'{name}: H={H}'
    cells.append((label, im, overlay))

# Skládáme do mřížky 2 sloupce × N řádků (= per name: original + overlay)
cell_w = 128
cell_h = 130
n = len(cells)
total_w = cell_w * 2 + 100  # extra label space
total_h = cell_h * n + 20

result = Image.new('RGBA', (total_w, total_h), (40, 40, 60, 255))
draw_main = ImageDraw.Draw(result)
for i, (label, orig, ov) in enumerate(cells):
    y = i * cell_h + 10
    result.paste(orig, (110, y))
    result.paste(ov, (110 + cell_w + 10, y))
    draw_main.text((10, y + 50), label, fill=(255, 255, 255, 255))

out = ROOT / '.source' / 'compare_shapes.png'
result.save(out)
print(f'saved: {out.relative_to(ROOT)} ({result.size[0]}×{result.size[1]})')
