// =============================================================================
// Tile rendering — sprite z RenderTexture cache + cliff face Graphics.
//
// **Architektura (Fáze 3.2):**
//   - `createTileSprite(typeId, variantIndex, cache)` → Sprite z pre-renderované
//     tile recipe (= top diamond + decorations). Anchor v lokál (0,0,0) = střed
//     tile.
//   - `createCliffGraphic(typeId, cliffRight, cliffLeft)` → Graphics, JEN dvě
//     boční stěny (BR + BL face). Top diamond NENÍ součástí (= je v sprite).
//     Kreslí se přímo per tile v gridu, dle z-rozdílu sousedů (decoupling
//     z cache).
//
// **Pozicování v gridu:**
//   - Sprite: `position.set(screenX, screenY + HALF_H)` — lokál (0,0,0) recipe
//     přistane na střed top diamondu tile.
//   - Cliff Graphics: `position.set(screenX, screenY)` — lokál (0,0) Graphics
//     je top corner tile, cliff faces visí dolů z bottom corner.
// =============================================================================

import { Sprite, Graphics } from 'pixi.js';
import { TILE_W, TILE_H, HALF_W, HALF_H } from './iso.js';
import { TILE_TYPES } from './palette.js';
import type { CachedSprite } from './render-cache.js';

// =============================================================================
// Helper — ztmaví hex barvu (násobí RGB komponenty faktorem 0..1).
// Lokální verze pro cliff face shading (= side face stínování). Pro recipe
// shading používá `iso3d.shade` (lerp k bílé/černé).
// =============================================================================
function darken(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/**
 * Vyrobí Sprite pro tile z pre-renderované cache (Fáze 3.2).
 *
 * Caller předá `cache` (`CachedSprite[][]` z `buildTileCache`), `typeId`
 * (= TILE_TYPES.id) a `variantIndex` (= 0..TILE_VARIANTS_PER_TYPE-1).
 *
 * Sprite má anchor v lokálním (0, 0, 0) recipe — `sprite.position(screenX,
 * screenY + HALF_H)` umístí střed tile na (screenX, screenY + HALF_H), kde
 * (screenX, screenY) je top corner tile (z `tileToScreen`).
 */
export function createTileSprite(
  typeId: number,
  variantIndex: number,
  cache: ReadonlyArray<ReadonlyArray<CachedSprite>>,
): Sprite {
  const variants = cache[typeId];
  if (!variants) {
    throw new Error(`Chybí tile cache pro typ ${typeId}`);
  }
  const cached = variants[variantIndex];
  if (!cached) {
    throw new Error(`Chybí variant ${variantIndex} pro typ ${typeId}`);
  }
  const sprite = new Sprite(cached.texture);
  sprite.anchor.set(cached.anchorX, cached.anchorY);
  return sprite;
}

/**
 * Vyrobí Graphics jen s cliff faces (= 2 boční stěny tile).
 *
 * Top diamond JE V tile sprite (z cache) — sem patří jen bočnice, jejichž
 * výška se mění per-tile dle z-rozdílu sousedů (kombinatorická exploze
 * by cachi zničila — proto decoupling).
 *
 * Lokální (0, 0) = top corner tile. Cliff faces visí dolů z bottom corner
 * (lokál (0, TILE_H)).
 *
 * @param typeId      index v TILE_TYPES (0..7)
 * @param cliffRight  výška BR cliff face v px (vůči SE sousedovi)
 * @param cliffLeft   výška BL cliff face v px (vůči SW sousedovi)
 *
 * @returns Graphics, nebo null pokud oba cliff jsou 0 (= rovinné okolí, žádné
 *          cliff kreslit).
 */
export function createCliffGraphic(
  typeId: number,
  cliffRight: number,
  cliffLeft: number,
): Graphics | null {
  if (cliffRight <= 0 && cliffLeft <= 0) return null;

  const def = TILE_TYPES[typeId];
  if (!def) {
    throw new Error(`Neznámý typ dlaždice: ${typeId}`);
  }

  const top = def.top;
  const sideLeft = darken(top, 0.65);
  const sideRight = darken(top, 0.80);

  const g = new Graphics();

  // Levá bočnice (BL face) — visí z bottom corner dolů, šikmo na -X side.
  if (cliffLeft > 0) {
    g.poly([
      -HALF_W, HALF_H,                  // left corner top
      0,       TILE_H,                  // bottom corner top
      0,       TILE_H + cliffLeft,      // bottom corner down
      -HALF_W, HALF_H + cliffLeft,      // left corner down
    ]).fill(sideLeft);
  }

  // Pravá bočnice (BR face) — visí z bottom corner dolů, šikmo na +X side.
  if (cliffRight > 0) {
    g.poly([
      0,      TILE_H,                   // bottom corner top
      HALF_W, HALF_H,                   // right corner top
      HALF_W, HALF_H + cliffRight,      // right corner down
      0,      TILE_H + cliffRight,      // bottom corner down
    ]).fill(sideRight);
  }

  return g;
}

/**
 * Vyrobí Sprite pro resource z pre-renderované cache (Fáze 3.1 + 3.3).
 *
 * Stejná struktura jako tile cache — `cache[resourceTypeId][variantIndex]`.
 * Pro resources s 1 variantou (stone, iron) caller předá `variantIndex = 0`.
 *
 * @param resourceTypeId  index v RESOURCE_TYPES (0..2)
 * @param variantIndex    index varianty (0..N-1, N = počet variant per typ)
 * @param cache           `CachedSprite[][]` z `buildTileCache(RESOURCE_RECIPES)`
 */
export function createResourceSprite(
  resourceTypeId: number,
  variantIndex: number,
  cache: ReadonlyArray<ReadonlyArray<CachedSprite>>,
): Sprite {
  const variants = cache[resourceTypeId];
  if (!variants) {
    throw new Error(`Chybí cache pro resource ${resourceTypeId}`);
  }
  const cached = variants[variantIndex];
  if (!cached) {
    throw new Error(`Chybí variant ${variantIndex} pro resource ${resourceTypeId}`);
  }
  const sprite = new Sprite(cached.texture);
  sprite.anchor.set(cached.anchorX, cached.anchorY);
  return sprite;
}

/**
 * Vyrobí Graphics pro highlight dlaždice pod kurzorem.
 * Kosočtverec stejné velikosti jako diamond top, s rámečkem a polopruhlednou
 * výplní. Top corner v (0, 0), takže `position.set(screenX, screenY)`
 * překryje correct tile.
 */
export function createHighlightGraphic(color: number): Graphics {
  const g = new Graphics();
  g.poly([
    0,        0,         // top
    HALF_W,   HALF_H,    // right
    0,        TILE_H,    // bottom
    -HALF_W,  HALF_H,    // left
  ])
    .fill({ color, alpha: 0.25 })
    .stroke({ color, width: 2, alignment: 0.5 });

  void TILE_W;   // umlčí unused-warning, ponecháno pro jednotnost s iso math
  return g;
}

/**
 * Vyrobí Graphics pro persistentní selection (vybranou dlaždici, Fáze 2.2.4).
 *
 * Stejný tvar jako highlight, ale silnější rámeček a víc výrazná výplň
 * — UX odlišuje "transient hover" (highlight) od "stálá volba" (selection).
 */
export function createSelectionGraphic(color: number): Graphics {
  const g = new Graphics();
  g.poly([
    0,        0,
    HALF_W,   HALF_H,
    0,        TILE_H,
    -HALF_W,  HALF_H,
  ])
    .fill({ color, alpha: 0.18 })
    .stroke({ color, width: 3, alignment: 0.5 });
  return g;
}
