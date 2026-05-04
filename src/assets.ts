// =============================================================================
// Asset loader — paralelně načítá tile textury.
//
// Po Y-squashi v `scripts/process_atlas.py` mají VŠECHNY dlaždice diamond
// half_h přesně 32 (= match `HALF_H` v iso.ts). Diamond top corner je tedy
// na PNG y=0 a anchor (0.5, 0) v rendereru funguje uniformně bez per-typ
// kompenzace.
//
// Pořadí ve výstupním poli odpovídá TILE_TYPES.id (= 0..7).
// =============================================================================

import { Assets, Texture } from 'pixi.js';
import { TILE_TYPES } from './palette.js';

/**
 * Načte všechny tile textury paralelně.
 *
 * Vrátí pole `Texture[]`, kde index = TILE_TYPES[i].id.
 * Pořadí je deterministické (Promise.all zachová pořadí promiseů).
 */
export async function loadTileTextures(): Promise<Texture[]> {
  const urls = TILE_TYPES.map((t) => `/assets/terrain/${t.name}01.png`);
  const textures = await Promise.all(
    urls.map((url) => Assets.load<Texture>(url)),
  );
  return textures;
}
