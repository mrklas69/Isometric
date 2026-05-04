# scripts/debug_shape.py
"""
Vytiskne tvar každé dlaždice po řádcích — kolik alpha pixelů na řádku v top
části (y=0..40). Podle profilu šířek se dá rozhodnout, kde je diamond top
corner (bod, kde šířka začne plynule růst).
"""
import sys
from PIL import Image
import numpy as np
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
TERRAIN = ROOT / 'public' / 'assets' / 'terrain'

for png in sorted(TERRAIN.glob('*.png')):
    arr = np.array(Image.open(png).convert('RGBA'))
    alpha = arr[..., 3]
    H, W = alpha.shape

    # Width per řádek pro horních 40 px
    print(f'\n{png.stem} ({W}×{H}):')
    for y in range(min(40, H)):
        n = int((alpha[y, :] > 0).sum())
        bar = '█' * (n // 2)   # 1 znak per 2 pixely
        print(f'  y={y:2d}  width={n:3d}  {bar}')
