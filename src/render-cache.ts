// =============================================================================
// Render cache — pre-rendering recipe → RenderTexture.
//
// Recipes (= primitive lists) jsou statické (deterministicky generované při
// boot). Renderovat je jako Graphics polygons by per-tile 10000× za frame
// bylo drahé. Místo toho je vyrenderujeme **jednou** do RenderTexture, sprite
// per tile pak používá tuto texturu (= GPU batch friendly).
//
// Volá se po `app.init()` (= renderer dostupný), výsledek se předává do
// `Grid` konstruktoru.
//
// Output per recipe: `{ texture, anchorX, anchorY }`. Anchor je v rationalu
// [0..1] a označuje, kde v textuře leží lokální (0, 0, 0) recipe — caller
// nastaví `sprite.anchor.set(anchorX, anchorY)` a `sprite.position(...)`,
// čímž lokální origin přistane na požadovaném screen bodu.
// =============================================================================

import { Graphics, RenderTexture } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import { drawRecipe, type Recipe } from './primitives.js';

/**
 * Pre-rendered recipe — sprite-ready textura + anchor pro umístění lokálního
 * (0, 0, 0) origin recipe na sprite.position.
 */
export type CachedSprite = {
  readonly texture: RenderTexture;
  readonly anchorX: number;   // 0..1, kde v textuře leží lokální (0, 0, 0)
  readonly anchorY: number;
};

// Padding kolem recipe v textuře — bezpečnostní rezerva proti antialias clipu
// na okrajích (renderer může potřebovat ±1 px za hranicí polygonu).
const TEXTURE_PADDING = 2;

/**
 * Vyrenderuje jeden recipe do RenderTexture a spočítá anchor pro lokální
 * origin (0, 0, 0).
 *
 * Postup:
 *   1. Nakreslit recipe do dočasného Graphics (lokální coords).
 *   2. Spočítat `getLocalBounds()` — bounding box vyrenderovaných polygons.
 *   3. Vytvořit RenderTexture velikosti bounds + padding.
 *   4. Posunout Graphics tak, aby (-minX + padding, -minY + padding) byl
 *      origin v rámci textury (= polygons se vejdou celé).
 *   5. Renderovat → texture obsahuje recipe vykreslené.
 *   6. Spočítat anchor: pozice lokál (0, 0) v texture / texture rozměry.
 *   7. Destroy temp Graphics — texture drží data nezávisle.
 */
function renderRecipeToTexture(renderer: Renderer, recipe: Recipe): CachedSprite {
  const g = new Graphics();
  drawRecipe(g, recipe);

  // Pixi v8 getLocalBounds() vrací Bounds {minX, minY, maxX, maxY, width, height}.
  const bounds = g.getLocalBounds();

  // Texture dimenze — zaokrouhlené nahoru, plus padding na obou stranách.
  const texW = Math.ceil(bounds.width)  + 2 * TEXTURE_PADDING;
  const texH = Math.ceil(bounds.height) + 2 * TEXTURE_PADDING;

  const texture = RenderTexture.create({ width: texW, height: texH });

  // Posun Graphics: lokální bod (minX, minY) → texture (padding, padding).
  // Tj. lokální (0, 0) → texture (-minX + padding, -minY + padding).
  const offsetX = -bounds.minX + TEXTURE_PADDING;
  const offsetY = -bounds.minY + TEXTURE_PADDING;
  g.position.set(offsetX, offsetY);

  renderer.render({ container: g, target: texture });

  // Anchor (= ratio): kde leží lokální (0, 0) v textuře.
  const anchorX = offsetX / texW;
  const anchorY = offsetY / texH;

  // Graphics už není potřeba — texture obsahuje hotový pixel data.
  g.destroy();

  return { texture, anchorX, anchorY };
}

/**
 * Vybuduje cache z 2D recipe pole — `recipes[typeId][variantIndex] = Recipe`.
 * Output: identická struktura, ale `CachedSprite` místo `Recipe`.
 *
 * Univerzální pro tile i resource recipes (= obojí má strukturu typ × varianta).
 * Volej po `app.init()` (renderer musí být dostupný).
 */
export function buildTileCache(
  renderer: Renderer,
  recipes: ReadonlyArray<ReadonlyArray<Recipe>>,
): CachedSprite[][] {
  const cache: CachedSprite[][] = [];
  for (let t = 0; t < recipes.length; t++) {
    const variants = recipes[t];
    if (!variants) {
      cache[t] = [];
      continue;
    }
    cache[t] = [];
    for (let v = 0; v < variants.length; v++) {
      cache[t]![v] = renderRecipeToTexture(renderer, variants[v]!);
    }
  }
  return cache;
}
