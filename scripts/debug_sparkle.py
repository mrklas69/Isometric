# scripts/debug_sparkle.py
"""
Debug: najde sparkle/watermark v atlasu a vrátí jeho přesnou pozici.

Strategie: v každé cell najít všechny connected components non-magenta pixelů,
seřadit podle velikosti, vypsat vše menší než 5% největší komponenty.
"""
import sys
from PIL import Image
import numpy as np
from pathlib import Path
from collections import deque

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / '.source' / 'terrain_atlas_v1.png'

img = Image.open(SRC).convert('RGBA')
W, H = img.size
arr = np.array(img)
r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
mag = (r > 230) & (g < 60) & (b > 230)
tile_mask = ~mag

cell_w = W // 4
cell_h = H // 2


def label_4connected(mask: np.ndarray) -> tuple[np.ndarray, list[int]]:
    """BFS labeling. Vrátí labels (int32) a seznam velikostí komponent (index 0 = label 1)."""
    h_, w_ = mask.shape
    labels = np.zeros((h_, w_), dtype=np.int32)
    sizes: list[int] = []
    cur = 0
    for y0 in range(h_):
        for x0 in range(w_):
            if mask[y0, x0] and labels[y0, x0] == 0:
                cur += 1
                size = 0
                queue = deque([(y0, x0)])
                labels[y0, x0] = cur
                while queue:
                    cy, cx = queue.popleft()
                    size += 1
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h_ and 0 <= nx < w_ and mask[ny, nx] and labels[ny, nx] == 0:
                            labels[ny, nx] = cur
                            queue.append((ny, nx))
                sizes.append(size)
    return labels, sizes


# Mrkneme na poslední cell (wetlands).
row, col = 1, 3
cx1, cy1 = col * cell_w, row * cell_h
cx2, cy2 = cx1 + cell_w, cy1 + cell_h
cell_tile = tile_mask[cy1:cy2, cx1:cx2]

print(f'Cell wetlands: ({cx1},{cy1}) - ({cx2},{cy2}) = {cell_w}×{cell_h}')
labels, sizes = label_4connected(cell_tile)
print(f'Components: {len(sizes)}')

# Seřaď podle velikosti
sorted_idx = sorted(range(len(sizes)), key=lambda i: -sizes[i])
for rank, idx in enumerate(sorted_idx[:5]):
    label_id = idx + 1
    component = labels == label_id
    ys, xs = np.where(component)
    bx1, by1 = int(xs.min()), int(ys.min())
    bx2, by2 = int(xs.max()), int(ys.max())
    # Globální souřadnice v atlasu
    gx1, gy1 = cx1 + bx1, cy1 + by1
    gx2, gy2 = cx1 + bx2, cy1 + by2
    print(f'  #{rank+1}: size={sizes[idx]:7d}  cell-bbox=({bx1},{by1})-({bx2},{by2})  '
          f'atlas-bbox=({gx1},{gy1})-({gx2},{gy2})')
