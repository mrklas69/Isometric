// =============================================================================
// Tile rendering — sprite-based (PNG textury) + highlight overlay.
//
// `createTileSprite(typeId, textures)` vrátí PIXI.Sprite s anchorem na top
// edge PNG. Po Y-squashi v pipeline má každá dlaždice diamond top corner
// přesně na y=0 → uniform anchor (0.5, 0) sedí pro všechny typy.
//
// `createHighlightGraphic(color)` vykreslí kosočtverec hover-rámečku stejné
// velikosti jako diamond top (TILE_W × TILE_H z iso.ts).
// =============================================================================

import { Sprite, Graphics, Texture } from 'pixi.js';
import { TILE_W, TILE_H, HALF_W, HALF_H, TILE_DEPTH } from './iso.js';
import { TILE_TYPES } from './palette.js';

// =============================================================================
// Helper — ztmaví hex barvu (násobí RGB komponenty faktorem 0..1).
// Používá se pro generování boční stěny ze základní barvy top diamondu.
// =============================================================================
function darken(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/**
 * Vyrobí Sprite pro danou typovou dlaždici.
 *
 * Anchor (0.5, 0) — kotva uprostřed šířky a na top edge sprite. Diamond
 * top corner je po Y-squashi v pipeline přesně na y=0, takže
 * `sprite.position.set(screenX, screenY)` umístí top corner přesně tam.
 *
 * @param typeId   index v TILE_TYPES (0..7)
 * @param textures pole textur ve stejném pořadí jako TILE_TYPES (z assets.ts)
 */
export function createTileSprite(typeId: number, textures: Texture[]): Sprite {
  const def = TILE_TYPES[typeId];
  if (!def) {
    throw new Error(`Neznámý typ dlaždice: ${typeId}`);
  }
  const tex = textures[typeId];
  if (!tex) {
    throw new Error(`Chybí textura pro tile typu ${typeId} (${def.name})`);
  }

  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5, 0);
  return sprite;
}

/**
 * DEBUG — vyrobí Graphics dlaždici procedurálně (top diamond + 2 bočnice).
 * Top corner v lokálních souřadnicích (0, 0) — po `g.position.set(X, Y)`
 * je top corner přesně v (X, Y). Tj. RENDER PATH JE NEZÁVISLÁ na sprite/texture
 * pipeline. Pokud i takhle vidíme schody, bug je v iso math nebo container
 * transformu, ne v sprite anchor / squash measurement.
 */
export function createTileGraphic(typeId: number): Graphics {
  const def = TILE_TYPES[typeId];
  if (!def) {
    throw new Error(`Neznámý typ dlaždice: ${typeId}`);
  }

  const top = def.top;
  const sideLeft = darken(top, 0.65);
  const sideRight = darken(top, 0.80);

  const g = new Graphics();

  // Bočnice první (z-order: nakresleno PŘED top diamondem v rámci jediného
  // Graphics — top diamond je překryje, jak má).
  g.poly([
    -HALF_W, HALF_H,
    0,       TILE_H,
    0,       TILE_H + TILE_DEPTH,
    -HALF_W, HALF_H + TILE_DEPTH,
  ]).fill(sideLeft);

  g.poly([
    0,      TILE_H,
    HALF_W, HALF_H,
    HALF_W, HALF_H + TILE_DEPTH,
    0,      TILE_H + TILE_DEPTH,
  ]).fill(sideRight);

  // Top diamond
  g.poly([
    0,        0,         // top corner — anchor lokál (0, 0)
    HALF_W,   HALF_H,    // right
    0,        TILE_H,    // bottom
    -HALF_W,  HALF_H,    // left
  ]).fill(top);

  // Tenký okraj diamondu — pomáhá vidět hranice mřížky
  g.poly([
    0,        0,
    HALF_W,   HALF_H,
    0,        TILE_H,
    -HALF_W,  HALF_H,
  ]).stroke({ color: darken(top, 0.4), width: 1, alignment: 0.5 });

  return g;
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
