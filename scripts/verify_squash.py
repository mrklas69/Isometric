import sys
from PIL import Image
import numpy as np
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

td = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'terrain'
print(f'{"name":12s} {"size":>9s} {"col0_y":>7s}  <— měl by být 32 pro každou')
print('-' * 50)
for png in sorted(td.glob('*.png')):
    arr = np.array(Image.open(png).convert('RGBA'))
    alpha = arr[..., 3]
    H, W = alpha.shape
    edge_tops = []
    for x in range(5):
        col = alpha[:, x]
        positive = np.where(col > 0)[0]
        if len(positive) > 0:
            edge_tops.append(int(positive[0]))
    col0_y = min(edge_tops) if edge_tops else -1
    print(f'{png.stem:12s} {W}x{H:<5d} {col0_y:>7d}')
