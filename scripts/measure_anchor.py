# scripts/measure_anchor.py
"""
Změří diamond top corner Y v každé tile PNG.

Heuristika: levá špička kosočtverce je v PNG na (0, top_corner_y + HALF_H).
Spočteme nejvyšší alpha>0 pixel v sloupci x=0 (a pár sousedních pro robustnost
proti AA artefaktům na okraji), odečteme HALF_H = 32 → diamond top corner Y.

Diamond top corner je často NIŽŠÍ než top edge PNG, pokud má dlaždice overflow
nahoru (treetops u forest, rákos u wetlands).
"""
import sys
from PIL import Image
import numpy as np
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
TERRAIN = ROOT / 'public' / 'assets' / 'terrain'
HALF_H = 32

print(f'{"name":12s} {"size":>10s} {"left_top":>10s} {"corner_y":>10s} {"% of H":>8s}')
print('-' * 60)

for png in sorted(TERRAIN.glob('*.png')):
    arr = np.array(Image.open(png).convert('RGBA'))
    alpha = arr[..., 3]
    H, W = alpha.shape

    # Nejvyšší alpha>0 pixel v každém z prvních 5 sloupců (robustní proti AA).
    edge_tops: list[int] = []
    for x in range(0, 5):
        col = alpha[:, x]
        positive = np.where(col > 0)[0]
        if len(positive) > 0:
            edge_tops.append(int(positive[0]))
    if not edge_tops:
        print(f'{png.stem:12s} {W}×{H:<5d}  {"?":>10s}  {"?":>10s}')
        continue

    left_top_y = min(edge_tops)
    corner_y = max(0, left_top_y - HALF_H)
    pct = 100.0 * corner_y / H if H > 0 else 0
    print(
        f'{png.stem:12s} {W}×{H:<5d}  {left_top_y:>10d}  {corner_y:>10d}  {pct:>7.1f}%'
    )
