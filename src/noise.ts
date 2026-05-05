// =============================================================================
// noise.ts — deterministic value-noise utility (bez external dep).
//
// Value-noise = jednoduchá alternativa Perlinu. Princip:
//   1. Pro každý integer (xi, yi) máme náhodnou hodnotu z hash funkce → [0, 1).
//   2. Pro spojité (x, y) interpolujeme bilineárně mezi 4 rohy buňky (xi, yi).
//   3. Před interpolací aplikujeme smoothstep na frakční část — bez něj by
//      byly přechody mezi buňkami "linkové" / blocky.
//
// Použití (2 oktávy v Isometric):
//   const lo = valueNoise2D(i * 0.05, j * 0.05, seed);   // velké tvary
//   const hi = valueNoise2D(i * 0.20, j * 0.20, seed^1); // detail
//   const z  = Math.floor(7 + 6 * (lo*2-1) + 2 * (hi*2-1));
//
// Determinismus: stejný (x, y, seed) vždy stejný výsledek. Žádný interní stav.
// =============================================================================

/**
 * Hashovací funkce — z trojice (x, y, seed) udělá pseudonáhodné [0, 1).
 *
 * Použité konstanty (374761393, 668265263, 1274126177) jsou prime numbers
 * z xxHash / Wang hash literatury — dávají dobrou bit-mixing kvalitu.
 *
 * Operace `| 0` a `>>> 0` v TS/JS vynucují 32-bit (signed / unsigned) integer
 * aritmetiku — bez nich by Math.imul výsledky přetekly do float.
 *
 * Exportováno — používá se i pro deterministic pick v rámci tile type variací
 * (heightToTileType v grid.ts) nebo pozdější resource placement.
 */
export function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  h = h ^ (h >>> 16);
  // /4294967296 = /2^32 → mapování unsigned 32-bit na [0, 1).
  return (h >>> 0) / 4294967296;
}

/**
 * Smoothstep (Hermite) — `t * t * (3 - 2*t)`.
 *
 * Vrací stejné hodnoty na okrajích (0→0, 1→1), ale derivace v 0 a 1 je nulová.
 * Bez tohoto by interpolace mezi buňkami měla viditelné "hrany" v bodech, kde
 * frakční část přechází přes celá čísla.
 */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Lineární interpolace — `lerp(a, b, 0) = a`, `lerp(a, b, 1) = b`. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 2D value noise. Vrací [0, 1) — pro signed [-1, 1) volající dělá `2 * v - 1`.
 *
 * @param x     spojitá souřadnice (integer = mřížkový bod, jinak interpolace)
 * @param y     stejně
 * @param seed  determinismus — různé seedy = nezávislé "vrstvy" šumu
 */
export function valueNoise2D(x: number, y: number, seed: number): number {
  // Math.floor i pro záporná čísla (na rozdíl od `| 0`, který trunkuje k nule).
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  // 4 rohy buňky (xi..xi+1, yi..yi+1).
  const a = hash2(xi,     yi,     seed);
  const b = hash2(xi + 1, yi,     seed);
  const c = hash2(xi,     yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);

  // Smoothstep na frakční části — viz komentář u smoothstep().
  const ux = smoothstep(xf);
  const uy = smoothstep(yf);

  // Bilinear interpolation: nejprve podél X (horní + dolní řádek),
  // pak mezi nimi podél Y.
  const top    = lerp(a, b, ux);
  const bottom = lerp(c, d, ux);
  return lerp(top, bottom, uy);
}

/**
 * 2D value noise mapovaný na [-1, 1) — pohodlí pro signed varianty.
 */
export function signedNoise2D(x: number, y: number, seed: number): number {
  return valueNoise2D(x, y, seed) * 2 - 1;
}
