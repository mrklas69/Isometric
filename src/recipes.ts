// =============================================================================
// Recipes — definice resource jako pole primitiv (s variantami).
//
// Struktura: `RESOURCE_RECIPES[resourceTypeId][variantIndex] = Recipe`. Každý
// recipe je `Primitive[]` v back-to-front render pořadí. Origin (0,0,0) =
// ground plane střed tile.
//
// Inspirace: TheCubes (Three.js sandbox v ../TheCubes/src/main.js):
//   - TREE  ≈ buildTree (cylinder kmen + 3 cones), zde 5 variant
//   - STONE ≈ buildRock (5 nepravidelných blobs, 3 odstíny)
//   - IRON  = stone + lesklý akcent
//
// Limit: max 5 primitiv per recipe. Drží low-poly look a brzdí scope creep.
// =============================================================================

import type { Recipe, BlobParams } from './primitives.js';
import { shade } from './iso3d.js';
import { ENDESGA32 } from './palette.js';
import { RESOURCE_TREE, RESOURCE_IRON, RESOURCE_STONE } from './resource.js';

// =============================================================================
// Helper — hexagonální blob "kupole" (pro kameny, rudu).
// =============================================================================

function makeStoneBlob(
  cx: number, cy: number, cz: number,
  r: number, color: number,
  seed: number,
): BlobParams {
  const vertices: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + seed * 0.31;
    const rr = r * (0.85 + 0.3 * Math.sin(seed * 1.7 + i * 0.9));
    const dz = r * 0.5 * Math.max(0, -Math.sin(angle));
    vertices.push([
      rr * Math.cos(angle),
      rr * Math.sin(angle),
      dz,
    ] as const);
  }
  return { kind: 'blob', cx, cy, cz, vertices, color };
}

// =============================================================================
// TREE — 5 variant
// =============================================================================
//
// Měřítko zmenšené 1/2 oproti původní verzi (uživatel feedback: "strom byl
// příliš velký"). Apex špičky max ~1.05 lokál units = ~67 px screen → strom
// dominuje nad tile, ale ne extrémně.
//
// Varianty:
//   A — jehličnatý velký        (kmen + 3 cones, klasický smrk)
//   B — listnatý velký          (kmen + 1 sphere koruna)
//   C — 2× mini jehličnatý      (dva malé smrčky uvnitř tile)
//   D — 2× mini listnatý        (dvě malé kuličky-stromky)
//   E — smíšený                 (1 mini jehličnatý + 1 mini listnatý)
// =============================================================================

const TRUNK_COLOR        = 0x6b4423;            // hnědá kmen
const TREE_LEAF_DARK     = ENDESGA32[14];       // 0x265c42 — sytá listová zelená (jehl.)
const TREE_LEAF_LIGHT    = ENDESGA32[13];       // 0x3e8948 — sytá tráva-zelená (list.)

// Var A — jehličnatý velký (klasický smrk)
const TREE_A: Recipe = [
  { kind: 'shadow', cx: 0, cy: 0, r: 0.25 },
  // Kmen
  { kind: 'cylinder', cx: 0, cy: 0, cz: 0,    r: 0.075, h: 0.45, color: TRUNK_COLOR },
  // 3 cones postupně užší
  { kind: 'cone', cx: 0, cy: 0, cz: 0.35, r: 0.275, h: 0.35, color: TREE_LEAF_DARK },
  { kind: 'cone', cx: 0, cy: 0, cz: 0.60, r: 0.21,  h: 0.30, color: TREE_LEAF_DARK },
  { kind: 'cone', cx: 0, cy: 0, cz: 0.80, r: 0.14,  h: 0.25, color: TREE_LEAF_DARK },
];

// Var B — listnatý velký (kmen + sphere koruna)
const TREE_B: Recipe = [
  { kind: 'shadow', cx: 0, cy: 0, r: 0.27 },
  // Kmen — nižší než jehličnatý (listnatý má korunu těsně nad zemí)
  { kind: 'cylinder', cx: 0, cy: 0, cz: 0,    r: 0.08, h: 0.35, color: TRUNK_COLOR },
  // Velká sphere koruna
  { kind: 'sphere',   cx: 0, cy: 0, cz: 0.50, r: 0.30, color: TREE_LEAF_LIGHT },
];

// Var C — 2× mini jehličnatý
// Pozice: strom 1 (NE / vzadu) → render dříve; strom 2 (SW / vpředu) → později
const TREE_C: Recipe = [
  { kind: 'shadow', cx: 0, cy: 0, r: 0.30 },
  // Strom 1 — vzadu (-X, -Y) = NE iso. Render první.
  { kind: 'cylinder', cx: -0.18, cy: -0.10, cz: 0,    r: 0.05, h: 0.20, color: TRUNK_COLOR },
  { kind: 'cone',     cx: -0.18, cy: -0.10, cz: 0.15, r: 0.18, h: 0.35, color: TREE_LEAF_DARK },
  // Strom 2 — vpředu (+X, +Y) = SW iso. Render druhý.
  { kind: 'cylinder', cx:  0.15, cy:  0.12, cz: 0,    r: 0.05, h: 0.20, color: TRUNK_COLOR },
  { kind: 'cone',     cx:  0.15, cy:  0.12, cz: 0.15, r: 0.18, h: 0.35, color: TREE_LEAF_DARK },
];

// Var D — 2× mini listnatý
const TREE_D: Recipe = [
  { kind: 'shadow', cx: 0, cy: 0, r: 0.30 },
  // Strom 1 (NE)
  { kind: 'cylinder', cx: -0.18, cy: -0.10, cz: 0,    r: 0.05, h: 0.18, color: TRUNK_COLOR },
  { kind: 'sphere',   cx: -0.18, cy: -0.10, cz: 0.30, r: 0.18, color: TREE_LEAF_LIGHT },
  // Strom 2 (SW)
  { kind: 'cylinder', cx:  0.15, cy:  0.12, cz: 0,    r: 0.05, h: 0.18, color: TRUNK_COLOR },
  { kind: 'sphere',   cx:  0.15, cy:  0.12, cz: 0.30, r: 0.18, color: TREE_LEAF_LIGHT },
];

// Var E — smíšený (1 mini jehličnatý vzadu + 1 mini listnatý vpředu)
const TREE_E: Recipe = [
  { kind: 'shadow', cx: 0, cy: 0, r: 0.30 },
  // Mini jehličnatý (NE / vzadu) — vyšší (cone), tmavší zelená
  { kind: 'cylinder', cx: -0.15, cy: -0.10, cz: 0,    r: 0.05, h: 0.20, color: TRUNK_COLOR },
  { kind: 'cone',     cx: -0.15, cy: -0.10, cz: 0.15, r: 0.18, h: 0.35, color: TREE_LEAF_DARK },
  // Mini listnatý (SW / vpředu) — kratší kmen, sphere
  { kind: 'cylinder', cx:  0.15, cy:  0.10, cz: 0,    r: 0.05, h: 0.18, color: TRUNK_COLOR },
  { kind: 'sphere',   cx:  0.15, cy:  0.10, cz: 0.30, r: 0.18, color: TREE_LEAF_LIGHT },
];

const TREE_RECIPES: Recipe[] = [TREE_A, TREE_B, TREE_C, TREE_D, TREE_E];

// =============================================================================
// STONE — 1 varianta (5 hexagonálních blobs, 3 odstíny)
// =============================================================================

const STONE_BASE  = ENDESGA32[20];
const STONE_DARK  = shade(STONE_BASE, 0.70);
const STONE_LIGHT = shade(STONE_BASE, 1.10);

// Měřítko zmenšeno 1/2 (uživatel feedback: kameny byly příliš velké).
// Půleny radius i pozice (cx, cy, cz) → kupa zaujímá ~čtvrtinu plochy tile.
const STONE_RECIPE: Recipe = [
  { kind: 'shadow', cx: 0, cy: 0, r: 0.275 },
  makeStoneBlob( 0.00,   0.00,  0,    0.225, STONE_BASE,   1.0),
  makeStoneBlob( 0.20,  -0.05,  0,    0.16,  STONE_DARK,   2.7),
  makeStoneBlob(-0.175,  0.05,  0,    0.15,  STONE_LIGHT,  4.3),
  makeStoneBlob( 0.05,   0.20,  0,    0.09,  STONE_DARK,   5.9),
  makeStoneBlob(-0.05,  -0.125, 0.10, 0.11,  STONE_BASE,   7.5),
];

// =============================================================================
// IRON — 1 varianta (4 blobs + 1 sphere lesk)
// =============================================================================

const IRON_BASE  = ENDESGA32[22];
const IRON_DARK  = shade(IRON_BASE, 0.70);
const IRON_LIGHT = shade(IRON_BASE, 1.20);
const IRON_SHINE = 0xffffff;

const IRON_RECIPE: Recipe = [
  { kind: 'shadow', cx: 0, cy: 0, r: 0.45 },
  makeStoneBlob( 0.00,  0.00, 0,    0.40, IRON_BASE,   11.0),
  makeStoneBlob( 0.30, -0.10, 0,    0.28, IRON_DARK,   12.7),
  makeStoneBlob(-0.30,  0.10, 0,    0.25, IRON_LIGHT,  14.3),
  makeStoneBlob( 0.05,  0.30, 0,    0.18, IRON_DARK,   15.9),
  { kind: 'sphere', cx: 0.05, cy: -0.05, cz: 0.30, r: 0.08, color: IRON_SHINE },
];

// =============================================================================
// Resource recipe registry — `RESOURCE_RECIPES[typeId][variantIndex]`.
// Indexovaný přes RESOURCE_* konstanty z resource.ts.
// =============================================================================

export const RESOURCE_RECIPES: Recipe[][] = [];
RESOURCE_RECIPES[RESOURCE_TREE]  = TREE_RECIPES;     // 5 variant
RESOURCE_RECIPES[RESOURCE_IRON]  = [IRON_RECIPE];    // 1 varianta
RESOURCE_RECIPES[RESOURCE_STONE] = [STONE_RECIPE];   // 1 varianta
