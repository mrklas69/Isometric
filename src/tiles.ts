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
import { RESOURCE_TYPES, RESOURCE_TREE, RESOURCE_IRON, RESOURCE_STONE } from './resource.js';

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
 * Vyrobí Graphics dlaždici procedurálně (top diamond + 2 bočnice).
 *
 * Top corner v lokálních souřadnicích (0, 0) — po `g.position.set(X, Y)`
 * je top corner přesně v (X, Y).
 *
 * **Cliff faces (Fáze 2.1.5)**: V izometrii vidíme jen jižní polovinu bočnic
 * (BR + BL). Jejich výška = výškový rozdíl k sousedovi pod nimi:
 *   - cliffRight (BR face) = max(0, z(i,j) - z(i+1, j)) * PIXELS_PER_LEVEL
 *   - cliffLeft  (BL face) = max(0, z(i,j) - z(i, j+1)) * PIXELS_PER_LEVEL
 *
 * Default `TILE_DEPTH` (= 32 px) se používá pro `procedural.ts` (texture gen
 * nezná sousedy → fixed depth). Grid předává explicitně spočítané hodnoty.
 *
 * @param typeId      index v TILE_TYPES (0..7)
 * @param cliffRight  výška BR cliff face v px (vůči SE sousedovi)
 * @param cliffLeft   výška BL cliff face v px (vůči SW sousedovi)
 */
export function createTileGraphic(
  typeId: number,
  cliffRight: number = TILE_DEPTH,
  cliffLeft: number = TILE_DEPTH,
): Graphics {
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
  // Když je cliff = 0 (rovinní sousedi), face neexistuje — vůbec nekreslíme.
  if (cliffLeft > 0) {
    g.poly([
      -HALF_W, HALF_H,                  // left corner
      0,       TILE_H,                  // bottom corner
      0,       TILE_H + cliffLeft,      // bottom-down
      -HALF_W, HALF_H + cliffLeft,      // left-down
    ]).fill(sideLeft);
  }

  if (cliffRight > 0) {
    g.poly([
      0,      TILE_H,                   // bottom corner
      HALF_W, HALF_H,                   // right corner
      HALF_W, HALF_H + cliffRight,      // right-down
      0,      TILE_H + cliffRight,      // bottom-down
    ]).fill(sideRight);
  }

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
 * Vyrobí Graphics overlay pro resource (Fáze 2.2.3).
 *
 * Overlay je child container s lokálními souřadnicemi vztaženými k top corner
 * tile (0, 0) = top corner. Střed top diamondu je v (0, HALF_H) = (0, 32).
 * Resource ikonka kreslíme nad/kolem tohoto bodu.
 *
 * Aktuálně procedurální Graphics (KISS, žádné PNG sprity). Vizuálně:
 *   - tree:  smrček (trojúhelník + kmen)
 *   - iron:  hranatá ruda (lichoběžník + lesk)
 *   - stone: nepravidelný kámen (mnohoúhelník)
 *
 * @param resourceTypeId  index v RESOURCE_TYPES (0..2)
 */
export function createResourceOverlay(resourceTypeId: number): Graphics {
  const def = RESOURCE_TYPES[resourceTypeId];
  if (!def) {
    throw new Error(`Neznámý resource: ${resourceTypeId}`);
  }

  const g = new Graphics();
  // Anchor pro overlay — střed top diamondu (= "uvnitř" tile).
  const cx = 0;
  const cy = HALF_H;   // = 32

  switch (resourceTypeId) {
    case RESOURCE_TREE: {
      // Smrček — kmen pod, koruna nahoře
      g.rect(cx - 2, cy + 4, 4, 8).fill(def.accent);
      g.poly([
        cx,      cy - 18,
        cx + 12, cy + 6,
        cx - 12, cy + 6,
      ]).fill(def.color);
      // Světlejší vrchol pro 3D dojem
      g.poly([
        cx,     cy - 16,
        cx + 6, cy - 4,
        cx - 6, cy - 4,
      ]).fill(darken(def.color, 1.4));
      break;
    }
    case RESOURCE_IRON: {
      // Hranatá ruda — lichoběžník (užší nahoře, širší dole)
      g.poly([
        cx - 6,  cy - 8,
        cx + 6,  cy - 8,
        cx + 10, cy + 8,
        cx - 10, cy + 8,
      ]).fill(def.accent);
      // Vnitřní světlejší plocha
      g.poly([
        cx - 4, cy - 6,
        cx + 4, cy - 6,
        cx + 7, cy + 5,
        cx - 7, cy + 5,
      ]).fill(def.color);
      // Diagonální lesk
      g.rect(cx - 3, cy - 4, 2, 4).fill(0xffffff);
      break;
    }
    case RESOURCE_STONE: {
      // Nepravidelný kámen
      g.poly([
        cx - 10, cy + 6,
        cx - 6,  cy - 4,
        cx + 4,  cy - 6,
        cx + 10, cy + 2,
        cx + 8,  cy + 10,
        cx - 4,  cy + 12,
      ]).fill(def.color);
      // Tmavší shadow vpravo dole
      g.poly([
        cx + 4,  cy - 6,
        cx + 10, cy + 2,
        cx + 8,  cy + 10,
        cx,      cy + 4,
      ]).fill(def.accent);
      break;
    }
  }

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
