// =============================================================================
// Procedural texture generator — vyrobí PIXI.Texture pro každý tile typ
// vyrenderováním PIXI.Graphics do RenderTexture.
//
// Účel: diagnostický test sprite/texture render path. Pokud sprite path drifty
// schody s PNG texturami, ale s těmito procedurálními texturami NE → bug je
// v PNG load path (frame metadata, anti-aliasing, dimenze). Pokud drift
// zůstane → bug je v sprite anchor / pivot kalkulaci, nezávisle na zdroji
// textury.
// =============================================================================

import { Application, RenderTexture, Texture } from 'pixi.js';
import { TILE_TYPES } from './palette.js';
import { createTileGraphic } from './tiles.js';
import { TILE_W, TILE_H, HALF_W, TILE_DEPTH } from './iso.js';

/**
 * Vyrobí texturu per tile typ vyrenderováním Graphics do RenderTexture.
 *
 * Bounding box Graphics z `createTileGraphic`:
 *   x ∈ [-HALF_W, HALF_W]      (= 128 wide)
 *   y ∈ [0, TILE_H + TILE_DEPTH] (= 64 + 32 = 96 tall)
 *
 * Aby (0, 0) v lokálních souřadnicích Graphics mapovalo na top corner
 * v textuře (= pixel (HALF_W, 0) v texture coords), posuneme Graphics
 * o (HALF_W, 0) před renderem do RenderTexture.
 *
 * Výsledná textura má rozměry 128×96 pro každý typ — VŠECHNY STEJNÉ.
 * Po Sprite anchor (0.5, 0) bude top corner v sprite.position a sprite
 * top edge v sprite.position taky (= pixel y=0 textury).
 */
export function makeProceduralTextures(app: Application): Texture[] {
  const W_total = TILE_W;                // 128
  const H_total = TILE_H + TILE_DEPTH;   // 64 + 32 = 96

  return TILE_TYPES.map((_, typeId) => {
    const g = createTileGraphic(typeId);
    g.position.set(HALF_W, 0);   // posun aby (0, 0) lokál → (HALF_W, 0) tex

    const tex = RenderTexture.create({
      width: W_total,
      height: H_total,
      // POZN.: PixiJS v8 default resolution = 1. Můžeme experimentovat
      // se zvýšenou resolution pro HiDPI shodu se sprite source — pokud
      // se ukáže, že drift je z resolution mismatch, ladíme tady.
    });

    app.renderer.render({ container: g, target: tex });

    // Graphics už není potřeba (= byla vykreslena do textury). Při typickém
    // použití by se měla destroy(). Pro teď ji ponecháme (memory triviální).
    return tex;
  });
}
