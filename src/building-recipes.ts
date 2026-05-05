// =============================================================================
// Building recipes — vzhled budov jako primitive recipes (analogicky resources).
//
// Struktura: `BUILDING_RECIPES[buildingTypeId][variantIndex] = Recipe`.
// Pro MVP každý typ má 1 variantu (= pole length 1).
//
// Origin (0, 0, 0) = STŘED tile na ground plane → budova "stojí" na tile.
// Sprite z cache se umístí na `(screenX, screenY + HALF_H)` aby lokál (0,0,0)
// přistálo na střed top diamond tile (= jako resource overlay).
// =============================================================================

import type { Recipe } from './primitives.js';
import { ENDESGA32 } from './palette.js';
import { BUILDING_MINE, BUILDING_STORAGE } from './building.js';

// =============================================================================
// MINE — vrtná věž / důl
// =============================================================================
//
// Vizuální koncept: industriální drill tower.
//   - Široký tmavý kovový podstavec (= sedí v terénu)
//   - Štíhlý ocelový pilíř (= vrtná tyč)
//   - Oranžová špička (= varovný / industrial drill bit, výrazná barva pro
//     dobrý kontrast proti šedé skály / kameni)
//
// Apex max ~0.95 lokál units = ~60 px screen → mine je viditelně vyšší než
// strom (apex ~0.85), ale ne extrémně dominantní.
// =============================================================================

const METAL_DARK  = ENDESGA32[23];   // 0x3a4466 — tmavá modrošedá ocel (podstavec)
const METAL_MID   = ENDESGA32[22];   // 0x8b9bb4 — střední šedá ocel (pilíř)
const WARN_ORANGE = ENDESGA32[10];   // 0xf77622 — sytá oranžová (drill bit)

const MINE_RECIPE: Recipe = [
  // Stín pod celou věží — širší než podstavec (= "footprint").
  { kind: 'shadow', cx: 0, cy: 0, r: 0.32 },
  // Podstavec — široký, nízký, tmavá ocel (sedí na zemi).
  { kind: 'cylinder', cx: 0, cy: 0, cz: 0,    r: 0.28, h: 0.18, color: METAL_DARK },
  // Pilíř — tenký, vysoký, střední ocel.
  { kind: 'cylinder', cx: 0, cy: 0, cz: 0.18, r: 0.07, h: 0.55, color: METAL_MID },
  // Drill bit — oranžový kužel na vrcholu.
  { kind: 'cone',     cx: 0, cy: 0, cz: 0.73, r: 0.10, h: 0.22, color: WARN_ORANGE },
];

// =============================================================================
// STORAGE — silo / sklad
// =============================================================================
//
// Vizuální koncept: krátký široký silo s červenou kuželovou střechou.
//   - Široký betonový válec (= "tělo skladu", béžový kontrast vůči mineové oceli)
//   - Červená kuželová střecha s mírným přesahem (= ikonický silo look)
//
// Apex max ~0.73 lokál units = ~47 px screen → silhouette nižší než mine
// (~0.95), ale širší (r 0.32 vs 0.28). Snadno rozlišitelné na první pohled.
// =============================================================================

const SILO_BODY = ENDESGA32[2];      // 0xead4aa — světlý béžový beton (kontrast vůči ocelové mine)
const SILO_ROOF = ENDESGA32[8];      // 0xe43b44 — sytá červená střecha (ikonický silo look)

const STORAGE_RECIPE: Recipe = [
  // Stín — širší než tělo (= footprint).
  { kind: 'shadow', cx: 0, cy: 0, r: 0.36 },
  // Tělo — široký, středně vysoký válec.
  { kind: 'cylinder', cx: 0, cy: 0, cz: 0,    r: 0.28, h: 0.55, color: SILO_BODY },
  // Střecha — červený kužel s mírným přesahem (r 0.32 > body r 0.28).
  { kind: 'cone',     cx: 0, cy: 0, cz: 0.55, r: 0.32, h: 0.18, color: SILO_ROOF },
];

// =============================================================================
// Registry — `BUILDING_RECIPES[typeId][variantIndex] = Recipe`. Index přes
// BUILDING_* konstanty z `building.ts`.
// =============================================================================

export const BUILDING_RECIPES: Recipe[][] = [];
BUILDING_RECIPES[BUILDING_MINE]    = [MINE_RECIPE];
BUILDING_RECIPES[BUILDING_STORAGE] = [STORAGE_RECIPE];
