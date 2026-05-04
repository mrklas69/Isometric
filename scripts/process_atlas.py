# scripts/process_atlas.py
"""
Zpracování zdrojového atlasu izometrických terénních dlaždic.

Vstup:  .source/terrain_atlas_v1.png  — 4×2 grid 8 dlaždic na #ff00ff pozadí.
Výstup: public/assets/terrain/{name}01.png — jednotlivé dlaždice s alpha kanálem.
        public/assets/terrain/manifest.json — metadata (rozměry, debug info).

Pipeline pro každou dlaždici:
    1. Najdi všechny connected components non-magenta pixelů uvnitř cellu
    2. Vezmi NEJVĚTŠÍ komponentu = vlastní tile (sparkle/AA/watermark jsou menší)
    3. Bbox té komponenty + crop ze zdrojového obrázku
    4. Maska alpha = 0 pro pixely, které NEPATŘÍ do největší komponenty
    5. Resize na šířku TARGET_W (uniform aspect ratio)
    6. **Y-SQUASH** na cílový diamond half_h (= match iso.ts HALF_H, std 2:1 iso)
    7. Uložit jako PNG + záznam do manifestu

Klíčový bod — krok 6 (Y-squash):
    Gemini občas renderuje dlaždice s mírně nestandardním ratio (1.5:1 místo 2:1).
    Měřený diamond half_h v PNG (= y_full - y_top, kde y_full je první řádek
    s plnou šířkou, y_top první řádek s alpha>0) je 43..51 px po uniform resize
    na width=128. Standardní 2:1 iso požaduje half_h=32 → squashujeme každou
    dlaždici Y-osou faktorem 32/half_h_measured. Po squashi je diamond top corner
    přesně na PNG y=0 a anchor (0.5, 0) v rendereru funguje pro všechny typy.

Connected components — vlastní BFS (4-connected), bez scipy závislosti.
"""

import sys
import json
from PIL import Image
import numpy as np
from pathlib import Path
from collections import deque

# Windows konzole má defaultně cp1250 — Unicode chars (→, ×) by spadly.
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Pořadí dlaždic v atlasu — řádky × sloupce, zleva-doprava, shora-dolů.
TILES: list[list[str]] = [
    ['grass',  'dirt',     'water', 'farmland'],
    ['forest', 'mountain', 'hills', 'wetlands'],
]

# Cesty
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / '.source' / 'terrain_atlas_v1.png'
OUT_DIR = ROOT / 'public' / 'assets' / 'terrain'

# Cílová šířka resized dlaždice — match `TILE_W` v src/iso.ts.
TARGET_W = 128

# Cílový diamond half_h — match `HALF_H` v src/iso.ts (= TILE_H/2 = 64/2 = 32).
# Po squashi má KAŽDÁ dlaždice diamond half_h přesně tuto hodnotu.
TARGET_HALF_H = 32

# Cílová celková výška PNG — VŠECHNY dlaždice padded na tuto velikost
# (transparent pixely zdola). Důvod: PixiJS sprite render path drifty
# při nesouměrné per-texture výšce → uniformní rozměr eliminuje issue.
# Hodnota by měla být >= max squashed height (= ~127 px pre-fix).
TARGET_TOTAL_H = 128

# Tolerance magenta detekce — pixely s těmito hodnotami pokládáme za pozadí.
MAG_R_MIN = 230
MAG_G_MAX = 60
MAG_B_MIN = 230

# Tolerance při hledání y_full (= první řádek "plné šířky") — kolik pixelů od plné
# šířky tolerujeme jako "plná šířka". 4 px = ignorujeme drobný AA na okrajích.
FULL_WIDTH_TOLERANCE = 4


def is_magenta_mask(arr: np.ndarray) -> np.ndarray:
    """Vrátí 2D bool masku — True = magenta pixel."""
    r = arr[..., 0]
    g = arr[..., 1]
    b = arr[..., 2]
    return (r > MAG_R_MIN) & (g < MAG_G_MAX) & (b > MAG_B_MIN)


def label_4connected(mask: np.ndarray) -> tuple[np.ndarray, list[int]]:
    """BFS labeling 4-connected komponent.

    Vrátí (labels, sizes), labels je int32 array, 0=background, 1..N=komponenty.
    """
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
                        if (
                            0 <= ny < h_
                            and 0 <= nx < w_
                            and mask[ny, nx]
                            and labels[ny, nx] == 0
                        ):
                            labels[ny, nx] = cur
                            queue.append((ny, nx))
                sizes.append(size)
    return labels, sizes


def measure_diamond_half_h(arr: np.ndarray) -> int:
    """Změří reálný diamond half_h v dlaždici (po uniform resize, před squashi).

    Heuristika: levá špička kosočtverce je v PNG na (0, half_h) — pixel je
    přesně na levém okraji sprite. Najdeme nejvyšší alpha>0 pixel v prvních
    5 sloupcích (robustní proti AA artefaktům přímo na pixelu špičky)
    → to je y levé špičky = half_h.

    Proč ne row-width threshold (předchozí přístup): AA halo na bočních
    hranách diamondu způsobuje, že full-width je dosažena 4–8 px POD
    skutečnou levou/pravou špičkou. To vede k under-squash a per-tile drift
    v rendereru. Měření přímo na sloupci x=0 sleduje přesně edge sprite
    bez tolerance threshold.

    Vrací aspoň 1 (degenerate fallback).
    """
    alpha = arr[..., 3]
    H, _ = alpha.shape

    edge_tops: list[int] = []
    for x in range(5):
        col = alpha[:, x]
        positive = np.where(col > 0)[0]
        if len(positive) > 0:
            edge_tops.append(int(positive[0]))

    if not edge_tops:
        return max(1, H // 2)

    return max(1, min(edge_tops))


def main() -> None:
    if not SRC.exists():
        raise FileNotFoundError(f'Zdrojový atlas neexistuje: {SRC}')
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    img = Image.open(SRC).convert('RGBA')
    W, H = img.size
    print(f'Atlas: {W}×{H} RGBA — {SRC.relative_to(ROOT)}')

    arr = np.array(img)
    mag = is_magenta_mask(arr)
    tile_mask = ~mag

    cell_w = W // 4
    cell_h = H // 2

    manifest: dict[str, dict[str, int | str]] = {}

    for row in range(2):
        for col in range(4):
            name = TILES[row][col]

            cx1, cy1 = col * cell_w, row * cell_h
            cx2, cy2 = cx1 + cell_w, cy1 + cell_h
            cell_tile = tile_mask[cy1:cy2, cx1:cx2]

            labels, sizes = label_4connected(cell_tile)
            if not sizes:
                print(f'  ! {name}: cell prázdná — přeskakuji')
                continue

            biggest_idx = max(range(len(sizes)), key=lambda i: sizes[i])
            biggest_label = biggest_idx + 1
            keep_mask = labels == biggest_label

            ys, xs = np.where(keep_mask)
            bx1, by1 = int(xs.min()), int(ys.min())
            bx2, by2 = int(xs.max()) + 1, int(ys.max()) + 1

            tile_crop = img.crop((cx1 + bx1, cy1 + by1, cx1 + bx2, cy1 + by2))
            tw, th = tile_crop.size

            keep_crop = keep_mask[by1:by2, bx1:bx2]
            tarr = np.array(tile_crop)
            tarr[~keep_crop, 3] = 0

            # ── Krok 5: Uniform resize na TARGET_W šířku, výška proporčně ──
            tile_alpha = Image.fromarray(tarr)
            scale = TARGET_W / tw
            uniform_h = max(1, int(round(th * scale)))
            tile_uniform = tile_alpha.resize(
                (TARGET_W, uniform_h),
                Image.Resampling.LANCZOS,
            )

            # ── Krok 6: Změř měřený half_h a Y-squash na TARGET_HALF_H ──
            uarr = np.array(tile_uniform)
            half_h_measured = measure_diamond_half_h(uarr)
            squash_y = TARGET_HALF_H / half_h_measured
            squashed_h = max(1, int(round(uniform_h * squash_y)))

            # POZN.: Pillow.resize s non-uniform proporcí Y-squashne sprite.
            # Pro mírné squashe (squash_y > 0.6) Lanczos drží velmi rozumnou
            # kvalitu — drobnější detaily budou stlačené, ale silueta zůstává.
            tile_squashed = tile_uniform.resize(
                (TARGET_W, squashed_h),
                Image.Resampling.LANCZOS,
            )

            # ── Krok 7: Pad/crop na uniform 128×TARGET_TOTAL_H ──
            # PixiJS sprite rendering driftuje při nesouměrných texture výškách.
            # Sjednocení rozměrů eliminuje drift. Top corner zůstává v y=0,
            # padding/crop děláme zdola.
            if squashed_h <= TARGET_TOTAL_H:
                final = Image.new('RGBA', (TARGET_W, TARGET_TOTAL_H), (0, 0, 0, 0))
                final.paste(tile_squashed, (0, 0))
            else:
                # Crop dolního přesahu (forest po squashi může mít >128 px).
                final = tile_squashed.crop((0, 0, TARGET_W, TARGET_TOTAL_H))

            # ── Krok 8: Ulož PNG + záznam do manifestu ──
            out_path = OUT_DIR / f'{name}01.png'
            final.save(out_path)

            manifest[name] = {
                'file': out_path.name,
                'width': TARGET_W,
                'height': TARGET_TOTAL_H,
                'contentHeight': squashed_h,    # užitečné z-order info
                'halfHMeasured': half_h_measured,
                'squashFactor': round(squash_y, 4),
            }

            other = sum(sizes) - sizes[biggest_idx]
            print(
                f'  + {name:10s}  src {tw}×{th}  uniform 128×{uniform_h}  '
                f'half_h={half_h_measured:2d}  squash={squash_y:.3f}  '
                f'content {TARGET_W}×{squashed_h}  →  padded {TARGET_W}×{TARGET_TOTAL_H}  '
                f'cleaned={other:5d}'
            )

    manifest_path = OUT_DIR / 'manifest.json'
    with manifest_path.open('w', encoding='utf-8') as f:
        json.dump({'tiles': manifest, 'targetHalfH': TARGET_HALF_H}, f, indent=2)
    print(f'\nManifest: {manifest_path.relative_to(ROOT)}')
    print(f'Hotovo. Výstup v {OUT_DIR.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
