# scripts/measure_diamond.py
"""
Změří skutečné rozměry diamond shapy v každé dlaždici:
  - y_top      = první y s alpha>0 (= top corner kosočtverce, případně overflow)
  - y_max_w    = první y kde row width = sprite width (= levá/pravá špička)
  - half_h     = y_max_w - y_top (= polovina výšky top diamondu v PNG)
  - expected   = HALF_H z iso.ts (= 32) — pokud reálná half_h neodpovídá, máme problém
  - depth      = sprite_h - y_max_w (= výška boční stěny od špičky dolů)
"""
import sys
from PIL import Image
import numpy as np
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
TERRAIN = ROOT / 'public' / 'assets' / 'terrain'

print(f'{"name":12s} {"size":>9s} {"y_top":>7s} {"y_full":>7s} {"half_h":>7s} {"depth":>7s}')
print('-' * 60)

for png in sorted(TERRAIN.glob('*.png')):
    arr = np.array(Image.open(png).convert('RGBA'))
    alpha = arr[..., 3]
    H, W = alpha.shape

    widths = (alpha > 0).sum(axis=1)   # počet alpha pixelů per řádek

    # y_top: první nenulová width
    nonzero = np.where(widths > 0)[0]
    y_top = int(nonzero[0]) if len(nonzero) else 0

    # y_full: první y kde width = W (sprite full width = levá+pravá špička jsou na okrajích)
    full = np.where(widths >= W)[0]
    y_full = int(full[0]) if len(full) else -1

    half_h = y_full - y_top if y_full >= 0 else -1
    depth = H - y_full if y_full >= 0 else -1

    print(f'{png.stem:12s} {W}×{H:<5d} {y_top:>7d} {y_full:>7d} {half_h:>7d} {depth:>7d}')
