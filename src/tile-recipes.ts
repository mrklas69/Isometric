// =============================================================================
// Tile recipes — vzhled jednotlivých druhů terénu jako primitive recipes.
//
// Architektura (Fáze 3.2):
//   - Každý tile typ má **3 varianty** → deterministická variabilita per (i, j).
//   - Recipe = `[diamond top, ...decorations]`. Max 5 primitiv per recipe
//     (= 1 diamond + max 4 decorations).
//   - Origin (0, 0, 0) = STŘED tile na ground plane. Decorations sedí v ground
//     range (-0.5, -0.5)..(+0.5, +0.5) a vystupují v +Z.
//
// **Cliff faces nejsou součástí recipe** — kreslí se procedurálně v `grid.ts`
// per-tile dle z-rozdílů sousedů (decoupling, viz CLAUDE.md / IDEAS.md).
//
// Inspirace: TheCubes voxel sandbox + klasický iso pixel art (decorations
// jako trsy / kamínky / vlnky pro variabilitu uvnitř pásem stejného typu).
// =============================================================================

import type { Recipe } from './primitives.js';
import { lightenToward, darkenToward } from './iso3d.js';
import { TILE_TYPES } from './palette.js';

// ID konstanty — synchronizace s `grid.ts` TYPE_*. Drží jméno na jednom místě.
const TYPE_GRASS    = 0;
const TYPE_DIRT     = 1;
const TYPE_WATER    = 2;
const TYPE_FARMLAND = 3;
const TYPE_FOREST   = 4;
const TYPE_MOUNTAIN = 5;
const TYPE_HILLS    = 6;
const TYPE_WETLANDS = 7;

// Sanity — pokud TILE_TYPES.length != 8, někdo přidal/odebral typ a recipes
// nejsou zaktualizované.
if (TILE_TYPES.length !== 8) {
  throw new Error(`Recipes ladí na 8 tile typů, ale paleta má ${TILE_TYPES.length}`);
}

// =============================================================================
// Barvy decorations — odvozené z TILE_TYPES.top, ale v zájmu čitelnosti je
// vyjmenuju explicitně (snadnější ladit per-typ vzhled).
// =============================================================================

const GRASS_BASE = TILE_TYPES[TYPE_GRASS]!.top;        // 0x3e8948
const GRASS_TUFT = lightenToward(GRASS_BASE, 0.20);     // světlejší zelená pro trsy
const FLOWER     = 0xfee761;                           // žlutý kvíťek (Endesga)

const DIRT_BASE  = TILE_TYPES[TYPE_DIRT]!.top;          // 0xb86f50
const DIRT_STONE = darkenToward(DIRT_BASE, 0.30);       // tmavší hnědé kamínky

const WATER_BASE = TILE_TYPES[TYPE_WATER]!.top;         // 0x0099db
const WATER_FOAM = lightenToward(WATER_BASE, 0.45);     // pěna / vlnka

const FARM_BASE   = TILE_TYPES[TYPE_FARMLAND]!.top;     // 0x733e39
const FARM_FURROW = darkenToward(FARM_BASE, 0.40);      // tmavá brázda
const SEEDLING    = 0x63c74d;                          // klíček (světle zelený)

const FOREST_BASE = TILE_TYPES[TYPE_FOREST]!.top;       // 0x265c42
const FOREST_TUFT = lightenToward(FOREST_BASE, 0.18);   // mírně světlejší zelená
const FOREST_BUSH = lightenToward(FOREST_BASE, 0.10);   // keřík

const MOUNTAIN_BASE  = TILE_TYPES[TYPE_MOUNTAIN]!.top;  // 0x5a6988
const MOUNTAIN_ROCK  = lightenToward(MOUNTAIN_BASE, 0.15); // skalka

const HILLS_BASE = TILE_TYPES[TYPE_HILLS]!.top;         // 0x63c74d
const HILLS_TUFT = darkenToward(HILLS_BASE, 0.15);      // tmavší zelená
const HILLS_STONE = 0x8b9bb4;                          // šedý kamínek

const WETLANDS_BASE = TILE_TYPES[TYPE_WETLANDS]!.top;   // 0x3e8948
const REED          = darkenToward(WETLANDS_BASE, 0.20); // tmavší zelená rákos
const PUDDLE        = lightenToward(WATER_BASE, 0.20);   // modrá kalužka

// =============================================================================
// Helper — drobný kamínek (4-vrcholový blob), zarovnaný v ground (z=0).
// Hash-based jitter dává blobům trochu rozdílný tvar.
// =============================================================================
function pebble(cx: number, cy: number, r: number, color: number, seed: number) {
  // 6 vrcholů kolem (cx, cy) v kruhu radius r, s drobnou jitter.
  const verts: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + seed * 0.41;
    const rr = r * (0.85 + 0.3 * Math.sin(seed * 1.7 + i * 0.9));
    // Z elevation: vrcholy "vzadu" (sin < 0) mírně zvednuté → kupolovitý look.
    const dz = r * 0.4 * Math.max(0, -Math.sin(a));
    verts.push([rr * Math.cos(a), rr * Math.sin(a), dz] as const);
  }
  return { kind: 'blob' as const, cx, cy, cz: 0, vertices: verts, color };
}

// =============================================================================
// Helper — brázda (= úzký obdélníkový blob, dlouhý podél +X iso osy).
//
// `yOffset` = pozice brázdy v lokální Y ose (= příčný rozestup mezi brázdami).
// `length` = délka brázdy v X (typicky 0.4 = pokryje většinu tile diagonály).
// `cz=0.01` = mírně nad diamondem proti Z-fight artefaktům (Pixi nepoužívá
// Z-buffer, ale render order je stabilnější).
// =============================================================================
function furrow(yOffset: number, length: number, color: number) {
  const halfLen = length / 2;
  const halfWidth = 0.025;
  return {
    kind: 'blob' as const,
    cx: 0, cy: yOffset, cz: 0.01,
    vertices: [
      [-halfLen, -halfWidth, 0],
      [+halfLen, -halfWidth, 0],
      [+halfLen, +halfWidth, 0],
      [-halfLen, +halfWidth, 0],
    ] as const,
    color,
  };
}

// =============================================================================
// GRASS — sytá zelená louka. Trsy trávy v base color.
// =============================================================================

const GRASS_RECIPES: Recipe[] = [
  // Var A — 3 trsy trávy
  [
    { kind: 'diamond', color: GRASS_BASE },
    { kind: 'cone', cx: -0.20, cy: -0.15, cz: 0, r: 0.05, h: 0.15, color: GRASS_TUFT },
    { kind: 'cone', cx:  0.15, cy:  0.10, cz: 0, r: 0.05, h: 0.15, color: GRASS_TUFT },
    { kind: 'cone', cx:  0.05, cy: -0.25, cz: 0, r: 0.04, h: 0.12, color: GRASS_TUFT },
  ],
  // Var B — 2 trsy + 1 květ
  [
    { kind: 'diamond', color: GRASS_BASE },
    { kind: 'cone',   cx: -0.18, cy:  0.08, cz: 0,    r: 0.05, h: 0.15, color: GRASS_TUFT },
    { kind: 'cone',   cx:  0.12, cy: -0.20, cz: 0,    r: 0.05, h: 0.15, color: GRASS_TUFT },
    { kind: 'sphere', cx:  0.18, cy:  0.15, cz: 0.04, r: 0.04, color: FLOWER },
  ],
  // Var C — 1 trs (skoro holé)
  [
    { kind: 'diamond', color: GRASS_BASE },
    { kind: 'cone', cx: 0, cy: 0.05, cz: 0, r: 0.06, h: 0.18, color: GRASS_TUFT },
  ],
];

// =============================================================================
// DIRT — hnědá hlína. Drobné kamínky v tmavší hnědé.
// =============================================================================

const DIRT_RECIPES: Recipe[] = [
  // Var A — 2 hnědé kamínky
  [
    { kind: 'diamond', color: DIRT_BASE },
    pebble(-0.15,  0.10, 0.10, DIRT_STONE, 1.0),
    pebble( 0.18, -0.15, 0.10, DIRT_STONE, 2.7),
  ],
  // Var B — 1 velký kámen
  [
    { kind: 'diamond', color: DIRT_BASE },
    pebble(0.05, 0, 0.18, DIRT_STONE, 4.3),
  ],
  // Var C — 3 malé kamínky
  [
    { kind: 'diamond', color: DIRT_BASE },
    pebble(-0.20, -0.10, 0.07, DIRT_STONE, 5.9),
    pebble( 0.05,  0.15, 0.07, DIRT_STONE, 7.5),
    pebble( 0.20, -0.05, 0.07, DIRT_STONE, 9.1),
  ],
];

// =============================================================================
// WATER — modrá voda. Vlnky / pěna v lighter modré.
// =============================================================================

const WATER_RECIPES: Recipe[] = [
  // Var A — 1 vlnka uprostřed
  [
    { kind: 'diamond', color: WATER_BASE },
    { kind: 'sphere', cx: 0, cy: 0, cz: 0, r: 0.10, color: WATER_FOAM },
  ],
  // Var B — 2 vlnky off-center
  [
    { kind: 'diamond', color: WATER_BASE },
    { kind: 'sphere', cx: -0.15, cy:  0.10, cz: 0, r: 0.08, color: WATER_FOAM },
    { kind: 'sphere', cx:  0.18, cy: -0.05, cz: 0, r: 0.08, color: WATER_FOAM },
  ],
  // Var C — 1 lesk vlevo nahoře (= odraz slunce)
  [
    { kind: 'diamond', color: WATER_BASE },
    { kind: 'sphere', cx: -0.10, cy: -0.10, cz: 0, r: 0.06, color: 0xffffff },
  ],
];

// =============================================================================
// FARMLAND — zorané pole. Paralelní brázdy.
// =============================================================================

const FARMLAND_RECIPES: Recipe[] = [
  // Var A — 3 brázdy paralelní (osa +X iso, lokál Y rozestupy)
  [
    { kind: 'diamond', color: FARM_BASE },
    furrow(-0.20, 0.40, FARM_FURROW),
    furrow( 0.00, 0.40, FARM_FURROW),
    furrow( 0.20, 0.40, FARM_FURROW),
  ],
  // Var B — 4 brázdy hustší
  [
    { kind: 'diamond', color: FARM_BASE },
    furrow(-0.24, 0.40, FARM_FURROW),
    furrow(-0.08, 0.40, FARM_FURROW),
    furrow( 0.08, 0.40, FARM_FURROW),
    furrow( 0.24, 0.40, FARM_FURROW),
  ],
  // Var C — 2 brázdy + 1 zelený klíček (= něco roste)
  [
    { kind: 'diamond', color: FARM_BASE },
    furrow(-0.15, 0.40, FARM_FURROW),
    furrow( 0.15, 0.40, FARM_FURROW),
    { kind: 'cone', cx: 0, cy: 0, cz: 0, r: 0.04, h: 0.10, color: SEEDLING },
  ],
];

// =============================================================================
// FOREST — tmavě zelený les. Trsy tmavé vegetace (NE stromy — strom je
// resource overlay v jiné vrstvě).
// =============================================================================

const FOREST_RECIPES: Recipe[] = [
  // Var A — 3 tmavé trsy vyšší
  [
    { kind: 'diamond', color: FOREST_BASE },
    { kind: 'cone', cx: -0.18, cy: -0.10, cz: 0, r: 0.07, h: 0.20, color: FOREST_TUFT },
    { kind: 'cone', cx:  0.15, cy:  0.12, cz: 0, r: 0.07, h: 0.20, color: FOREST_TUFT },
    { kind: 'cone', cx:  0.05, cy: -0.20, cz: 0, r: 0.06, h: 0.18, color: FOREST_TUFT },
  ],
  // Var B — 2 trsy + 1 keřík
  [
    { kind: 'diamond', color: FOREST_BASE },
    { kind: 'cone',   cx: -0.18, cy:  0.10, cz: 0,    r: 0.07, h: 0.20, color: FOREST_TUFT },
    { kind: 'cone',   cx:  0.18, cy: -0.10, cz: 0,    r: 0.07, h: 0.20, color: FOREST_TUFT },
    { kind: 'sphere', cx:  0.05, cy:  0.20, cz: 0.07, r: 0.10, color: FOREST_BUSH },
  ],
  // Var C — 4 nízké trsy
  [
    { kind: 'diamond', color: FOREST_BASE },
    { kind: 'cone', cx: -0.20, cy: -0.15, cz: 0, r: 0.05, h: 0.13, color: FOREST_TUFT },
    { kind: 'cone', cx:  0.15, cy: -0.18, cz: 0, r: 0.05, h: 0.13, color: FOREST_TUFT },
    { kind: 'cone', cx: -0.10, cy:  0.18, cz: 0, r: 0.05, h: 0.13, color: FOREST_TUFT },
    { kind: 'cone', cx:  0.20, cy:  0.10, cz: 0, r: 0.05, h: 0.13, color: FOREST_TUFT },
  ],
];

// =============================================================================
// MOUNTAIN — šedá hora. Skalky a kamínky.
// =============================================================================

const MOUNTAIN_RECIPES: Recipe[] = [
  // Var A — 1 velká skalka
  [
    { kind: 'diamond', color: MOUNTAIN_BASE },
    { kind: 'cone', cx: 0, cy: 0, cz: 0, r: 0.20, h: 0.30, color: MOUNTAIN_ROCK },
  ],
  // Var B — 2 střední skalky
  [
    { kind: 'diamond', color: MOUNTAIN_BASE },
    { kind: 'cone', cx: -0.15, cy:  0.05, cz: 0, r: 0.13, h: 0.22, color: MOUNTAIN_ROCK },
    { kind: 'cone', cx:  0.15, cy: -0.08, cz: 0, r: 0.13, h: 0.22, color: MOUNTAIN_ROCK },
  ],
  // Var C — 3 malé kamínky
  [
    { kind: 'diamond', color: MOUNTAIN_BASE },
    pebble(-0.18, -0.10, 0.08, MOUNTAIN_ROCK, 21.0),
    pebble( 0.10,  0.15, 0.08, MOUNTAIN_ROCK, 22.7),
    pebble( 0.20, -0.08, 0.06, MOUNTAIN_ROCK, 24.3),
  ],
];

// =============================================================================
// HILLS — světle zelený kopec.
// =============================================================================

const HILLS_RECIPES: Recipe[] = [
  // Var A — 2 trsy trávy
  [
    { kind: 'diamond', color: HILLS_BASE },
    { kind: 'cone', cx: -0.15, cy: -0.10, cz: 0, r: 0.06, h: 0.16, color: HILLS_TUFT },
    { kind: 'cone', cx:  0.15, cy:  0.10, cz: 0, r: 0.06, h: 0.16, color: HILLS_TUFT },
  ],
  // Var B — 1 trs + 1 šedý kámen
  [
    { kind: 'diamond', color: HILLS_BASE },
    { kind: 'cone', cx: -0.18, cy:  0.10, cz: 0, r: 0.06, h: 0.16, color: HILLS_TUFT },
    pebble(0.15, -0.05, 0.10, HILLS_STONE, 31.0),
  ],
  // Var C — 3 trsy v řadě (po +X iso ose)
  [
    { kind: 'diamond', color: HILLS_BASE },
    { kind: 'cone', cx: -0.20, cy:  0.00, cz: 0, r: 0.05, h: 0.14, color: HILLS_TUFT },
    { kind: 'cone', cx:  0.00, cy:  0.00, cz: 0, r: 0.05, h: 0.14, color: HILLS_TUFT },
    { kind: 'cone', cx:  0.20, cy:  0.00, cz: 0, r: 0.05, h: 0.14, color: HILLS_TUFT },
  ],
];

// =============================================================================
// WETLANDS — mokřady. Rákosy + kalužky.
// =============================================================================

const WETLANDS_RECIPES: Recipe[] = [
  // Var A — 3 vysoké rákosy
  [
    { kind: 'diamond', color: WETLANDS_BASE },
    { kind: 'cone', cx: -0.18, cy: -0.10, cz: 0, r: 0.04, h: 0.30, color: REED },
    { kind: 'cone', cx:  0.10, cy:  0.15, cz: 0, r: 0.04, h: 0.30, color: REED },
    { kind: 'cone', cx:  0.20, cy: -0.18, cz: 0, r: 0.04, h: 0.28, color: REED },
  ],
  // Var B — 2 rákosy + 1 kalužka
  [
    { kind: 'diamond', color: WETLANDS_BASE },
    { kind: 'cone',   cx: -0.18, cy: -0.05, cz: 0, r: 0.04, h: 0.30, color: REED },
    { kind: 'cone',   cx:  0.20, cy:  0.10, cz: 0, r: 0.04, h: 0.28, color: REED },
    { kind: 'sphere', cx:  0.00, cy:  0.18, cz: 0, r: 0.10, color: PUDDLE },
  ],
  // Var C — 4 rákosy hustě
  [
    { kind: 'diamond', color: WETLANDS_BASE },
    { kind: 'cone', cx: -0.20, cy: -0.15, cz: 0, r: 0.04, h: 0.28, color: REED },
    { kind: 'cone', cx: -0.05, cy:  0.05, cz: 0, r: 0.04, h: 0.30, color: REED },
    { kind: 'cone', cx:  0.10, cy:  0.20, cz: 0, r: 0.04, h: 0.26, color: REED },
    { kind: 'cone', cx:  0.20, cy: -0.10, cz: 0, r: 0.04, h: 0.28, color: REED },
  ],
];

// =============================================================================
// Registry — `TILE_RECIPES[typeId][variantIndex] = Recipe`. Indexovaný přes
// TYPE_* konstanty (= TILE_TYPES.id).
// =============================================================================

export const TILE_VARIANTS_PER_TYPE = 3;

export const TILE_RECIPES: Recipe[][] = [];
TILE_RECIPES[TYPE_GRASS]    = GRASS_RECIPES;
TILE_RECIPES[TYPE_DIRT]     = DIRT_RECIPES;
TILE_RECIPES[TYPE_WATER]    = WATER_RECIPES;
TILE_RECIPES[TYPE_FARMLAND] = FARMLAND_RECIPES;
TILE_RECIPES[TYPE_FOREST]   = FOREST_RECIPES;
TILE_RECIPES[TYPE_MOUNTAIN] = MOUNTAIN_RECIPES;
TILE_RECIPES[TYPE_HILLS]    = HILLS_RECIPES;
TILE_RECIPES[TYPE_WETLANDS] = WETLANDS_RECIPES;

// Sanity — všechny typy mají všechny varianty.
for (let t = 0; t < TILE_RECIPES.length; t++) {
  if (TILE_RECIPES[t]?.length !== TILE_VARIANTS_PER_TYPE) {
    throw new Error(`Tile typ ${t} má ${TILE_RECIPES[t]?.length} variant, očekáváno ${TILE_VARIANTS_PER_TYPE}`);
  }
}
