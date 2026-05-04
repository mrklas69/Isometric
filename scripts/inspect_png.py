"""Inspekce PNG metadat — chunky, DPI, gamma, atd."""
import sys
from PIL import Image
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

td = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'terrain'
for png in sorted(td.glob('*.png')):
    im = Image.open(png)
    print(f'{png.name}: size={im.size} mode={im.mode}')
    print(f'  info={dict(im.info)}')
    # PNG-specific chunks
    if hasattr(im, 'png') and im.png:
        print(f'  png_chunks={list(im.png.im.chunks) if hasattr(im.png, "im") else "?"}')
    print()
