// =============================================================================
// Izometrická matematika — převod tile (i, j) ↔ screen (x, y).
//
// Klasický izometrický grid s diamond-shape dlaždicemi 2:1 poměru:
//   - osa i jde dolů-doprava (na obrazovce)
//   - osa j jde dolů-doleva (na obrazovce)
//   - osa "výška" je grafický posun nahoru (záporné Y)
//
// Souřadnice tile (0, 0) = screen (0, 0) (top corner kosočtverce).
// =============================================================================

// Rozměry jedné dlaždice v pixelech.
// Poměr 2:1 (TILE_W = 2 × TILE_H) je standardní izometrická projekce.
export const TILE_W = 128;
export const TILE_H = 64;

// Polovina rozměrů — používá se v mnoha vzorcích, vyplatí se mít konstantu.
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

// Hloubka boční stěny v pixelech — pro 3D-ish render dlaždice (top diamond
// + 2 bočnice). Používá createTileGraphic + makeProceduralTextures.
export const TILE_DEPTH = 32;

/**
 * Převod tile souřadnic na screen pixel pozici.
 *
 * Vzorec: top-corner kosočtverce dlaždice (i, j) je v
 *   x = (i - j) * HALF_W
 *   y = (i + j) * HALF_H
 *
 * Top-corner = nejvyšší bod kosočtverce (špička nahoře).
 */
export function tileToScreen(i: number, j: number): { x: number; y: number } {
  return {
    x: (i - j) * HALF_W,
    y: (i + j) * HALF_H,
  };
}

/**
 * Inverzní převod screen → tile. Vrací zlomkové (i, j) — pro pickování
 * je dále potřeba zaokrouhlit na celé indexy.
 *
 * Vzorec inverzí lineární soustavy:
 *   x = (i - j) * HALF_W           => (i - j) = x / HALF_W
 *   y = (i + j) * HALF_H           => (i + j) = y / HALF_H
 *   ───────────────────────────────────────────────────────
 *   i = (x / HALF_W + y / HALF_H) / 2
 *   j = (y / HALF_H - x / HALF_W) / 2
 *
 * POZN.: V tile-pickování je (x, y) souřadnice STŘEDU dlaždice; vstup je top
 * corner. Pro pickování pod kurzorem proto chce volající posunout vstupní y
 * o -HALF_H (kompenzace top vs střed) — viz input.ts.
 */
export function screenToTile(x: number, y: number): { i: number; j: number } {
  const a = x / HALF_W;
  const b = y / HALF_H;
  return {
    i: (a + b) / 2,
    j: (b - a) / 2,
  };
}
