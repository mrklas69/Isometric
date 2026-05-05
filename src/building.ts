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
 * Output slot budovy (Fáze 5.2). Producent (např. Mine) sem ukládá vyrobený
 * resource. Hráč ho vyzvedne klikem (= ručně, dokud nemáme dopravníky).
 *
 * - `type`     : resource id (RESOURCE_*) — fixní pro životnost budovy.
 *                Pro Mine se nastaví při placement z resource pod tile.
 * - `amount`   : aktuální množství (mutable, 0..capacity).
 * - `capacity` : strop, při kterém produkce stagnuje (žánrový tlak na transport).
 */
export type OutputSlot = {
  readonly type: number;          // RESOURCE_* konstanta — fixní per instance
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
export const BUILDING_MINE = 0;

export const BUILDING_TYPES: readonly BuildingTypeDef[] = [
  { id: BUILDING_MINE, name: 'mine' },
] as const;

// Sanity — kdyby někdo přidal typ a zapomněl konstantu.
if (BUILDING_TYPES.length !== 1) {
  throw new Error(`Očekáván 1 typ budovy, je jich ${BUILDING_TYPES.length}`);
}

// =============================================================================
// Konstanty produkce (Fáze 5.2)
// =============================================================================

/** Kapacita output slotu Mine — full = produkce stagnuje. */
export const MINE_OUTPUT_CAPACITY = 50;

/**
 * Kolik tiků trvá vyrobit 1 unit. Při TPS=30 → 60 tiků = 2 s real-time.
 * Při speed 100× = ~30 unit/s → full slot za ~1.7 s.
 */
export const MINE_TICKS_PER_UNIT = 60;

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
  getResourceAt(i: number, j: number): number | null;
  getBuildingAt(i: number, j: number): number | null;
};

/**
 * Vrátí true pokud na tile (i, j) lze umístit budovu daného typu.
 *
 * Pravidla pro MINE (Fáze 5.1):
 *   - tile je v rámci gridu
 *   - tile NESMÍ mít už nějakou budovu
 *   - tile MUSÍ mít resource IRON nebo STONE (TREE = sběr ručně, ne mine)
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

  // Neznámý typ → ne (defensive).
  return false;
}
