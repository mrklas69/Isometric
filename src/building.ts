// =============================================================================
// Building — typy + placement validace pro budovy (Fáze 5.1).
//
// Struktura modulů (centrální registr pattern):
//   - `building.ts`         (tady) — typy + canPlaceBuilding (pure function)
//   - `buildings.ts`        — Buildings třída (Map<id, Building>, register/unreg)
//   - `building-recipes.ts` — recipes per typ → primitiva (low-poly look)
//   - `build-mode.ts`       — UI/UX state pro build režim (ghost, tint)
//
// Z Grid pohledu: budova je v `tileBuilding[i][j]` jako `buildingId` (= lookup
// na centrální Buildings.byId). Grid zná ID, Buildings zná data.
// =============================================================================

import { GRID_SIZE } from './grid.js';
import { RESOURCE_IRON, RESOURCE_STONE } from './resource.js';

// =============================================================================
// Typy
// =============================================================================

export type BuildingTypeDef = {
  readonly id: number;
  readonly name: string;          // používá HUD pro `BUILD: <name>`
};

/**
 * Output slot budovy (Fáze 5.2 + 5.3). Resource container — slouží jako:
 *   - producer output (Mine): typ se nastaví při placement, amount roste s tickem
 *   - storage container (Storage): typ je null dokud první deposit, pak se
 *     nastaví na deposited type. Po withdraw na 0 → type se vrací na null.
 *
 * Pole:
 * - `type`     : resource id (RESOURCE_*) NEBO `null` (= "empty, no committed
 *                type"). Mutable pro storage scénář (deposit může nastavit typ,
 *                withdraw na 0 ho zruší). Pro Mine je nastaven při placement
 *                a nikdy se nemění.
 * - `amount`   : aktuální množství (mutable, 0..capacity).
 * - `capacity` : strop. Pro Mine: full → produkce stagnuje. Pro Storage: full
 *                → další deposity se nezdaří.
 */
export type OutputSlot = {
  type: number | null;            // RESOURCE_* konstanta nebo null (empty)
  amount: number;                 // mutable
  readonly capacity: number;      // fixní per typ budovy
};

/** Runtime instance budovy (single-tile pro MVP). */
export type Building = {
  readonly id: number;            // unikátní per Buildings registry
  readonly typeId: number;        // BUILDING_* konstanta
  readonly i: number;             // pozice na gridu
  readonly j: number;
  /**
   * Output slot. null pro budovy bez produkce (zatím žádné takové, ale rezerva
   * pro budoucí typy: sklad, HQ, dopravník).
   */
  output: OutputSlot | null;
};

// =============================================================================
// Building type id konstanty + registry
// =============================================================================

// id = index v BUILDING_TYPES. Stabilní — nikdy nepřeházet, jinak by save/load
// zlomilo (až je budeme mít).
export const BUILDING_MINE    = 0;
export const BUILDING_STORAGE = 1;

export const BUILDING_TYPES: readonly BuildingTypeDef[] = [
  { id: BUILDING_MINE,    name: 'mine' },
  { id: BUILDING_STORAGE, name: 'storage' },
] as const;

// Sanity — kdyby někdo přidal typ a zapomněl konstantu.
if (BUILDING_TYPES.length !== 2) {
  throw new Error(`Očekávány 2 typy budovy, je jich ${BUILDING_TYPES.length}`);
}

// =============================================================================
// Konstanty produkce (Fáze 5.2) + skladu (Fáze 5.3)
// =============================================================================

/** Kapacita output slotu Mine — full = produkce stagnuje. */
export const MINE_OUTPUT_CAPACITY = 50;

/**
 * Kolik tiků trvá vyrobit 1 unit. Při TPS=30 → 60 tiků = 2 s real-time.
 * Při speed 100× = ~30 unit/s → full slot za ~1.7 s.
 */
export const MINE_TICKS_PER_UNIT = 60;

/**
 * Kapacita Storage — 4× větší než Mine. Motivuje hráče stavět sklady jako
 * sink pro produkci dolů (= žánrový pattern factory builder: producer →
 * storage → consumer). Single-type slot pro MVP — multi-resource sklady
 * až ve fázi 5.4+.
 */
export const STORAGE_CAPACITY = 200;

// =============================================================================
// canPlaceBuilding — placement validation
// =============================================================================
//
// Pure function (žádná mutation). Caller (input.ts pro klik, build-mode.ts pro
// ghost preview) ji volá, aby zjistil, jestli na (i, j) lze umístit budovu
// daného typu.
//
// **Cyklus importů**: building.ts by neměl importovat grid.ts runtime (= cyklus
// přes buildings.ts → building.ts). Místo Grid přijímáme `GridLike` interface
// — Grid ho implementuje implicitně (duck typing). Pure compile-time závislost
// zlomí cyklus.
// =============================================================================

/** Minimální kontrakt, který canPlaceBuilding potřebuje od Gridu. */
export type GridLike = {
  getTypeAt(i: number, j: number): number | null;
  getResourceAt(i: number, j: number): number | null;
  getBuildingAt(i: number, j: number): number | null;
};

// Tile typeId konstanty (= TILE_TYPES indexy z palette.ts), které canPlaceBuilding
// potřebuje pro pravidla per typ budovy. Drží duplicitu malou (jen 2 hodnoty)
// — alternativa by byl import z grid.ts, což by uzavřel cyklus building → grid →
// building. Pokud by se id v palette.ts přeházely (= zlomilo by to mapy stejně),
// najdeme to grepem `TYPE_WATER`/`TYPE_MOUNTAIN`.
const TYPE_WATER    = 2;
const TYPE_MOUNTAIN = 5;

/**
 * Vrátí true pokud na tile (i, j) lze umístit budovu daného typu.
 *
 * Společná pravidla:
 *   - tile je v rámci gridu
 *   - tile NESMÍ mít už nějakou budovu
 *
 * Pravidla per typ:
 *   - MINE    (Fáze 5.1): tile MUSÍ mít resource IRON nebo STONE (TREE = sběr ručně).
 *   - STORAGE (Fáze 5.3): tile NESMÍ být water ani mountain (= jen "rovinatý"
 *                          terén) a NESMÍ mít resource (= resource tile patří
 *                          mineru, sklad ho nesmí blokovat).
 */
export function canPlaceBuilding(
  grid: GridLike,
  i: number, j: number,
  typeId: number,
): boolean {
  // Out of bounds — nelze stavět mimo mapu.
  if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) return false;

  // Už tam stojí jiná budova → nelze.
  if (grid.getBuildingAt(i, j) !== null) return false;

  if (typeId === BUILDING_MINE) {
    // Mine = na resource IRON nebo STONE.
    const r = grid.getResourceAt(i, j);
    return r === RESOURCE_IRON || r === RESOURCE_STONE;
  }

  if (typeId === BUILDING_STORAGE) {
    // Storage = passable terén, žádný resource.
    const t = grid.getTypeAt(i, j);
    if (t === TYPE_WATER || t === TYPE_MOUNTAIN) return false;
    if (grid.getResourceAt(i, j) !== null) return false;
    return true;
  }

  // Neznámý typ → ne (defensive).
  return false;
}
