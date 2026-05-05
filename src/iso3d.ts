// =============================================================================
// Iso3d — projekce 3D lokálních souřadnic primitivů do screen-space
// (klasický 2:1 dimetric isometric).
//
// Slouží jako základ pro `primitives.ts` a `recipes.ts` — definice resource /
// terrain v 3D myšlení (kompozice cylindrů, cones, koulí, blobs), pak projekce
// vykreslí jako 2D polygons. Inspirace: TheCubes `buildTree` / `buildRock`
// (Three.js low-poly), zde převedeno do 2D iso PixiJS.
//
// Konvence souřadnic:
//   X osa  = iso "south-east" (= screen +X, +Y)
//   Y osa  = iso "south-west" (= screen -X, +Y)
//   Z osa  = vertikálně nahoru (= screen -Y)
//
// Recipe origin (0, 0, 0) = střed tile na ground plane. Tj. když chcem objekt
// vykreslit "ve středu tile", primitivy mají cx = cy = 0 v ground plane a
// rostou v +Z. Sprite z cache se pak umisťuje na `(screenX, screenY + HALF_H)`,
// aby lokální (0, 0, 0) přistálo na středu top diamondu tile.
//
// Měřítko (= jak velké jsou objekty vůči tile):
//   1 unit X        → HALF_W px screen-x (= 64 px)   = celá tile diagonála
//   1 unit Y        → HALF_W px screen-x (zrcadlově) = celá tile diagonála
//   1 unit X+Y      → 0 screen-x, TILE_H px screen-y (= 64 px) = celá tile přes
//                                                                   diagonálu
//   1 unit Z        → TILE_H px screen-up (= 64 px)  = "kostka 1×1×1 vysoká
//                                                       jako tile je hluboká"
//
// Tato volba dává **kostku 1×1×1 vyrenderovanou jako tile půdorys + výška =
// tile přes diagonálu** = klasický voxel look (jako TheCubes CCUBES + výška).
// =============================================================================

import { HALF_W, HALF_H, TILE_H } from './iso.js';

// --- Měřítka projekce ---
// LOCAL_UNIT_X / Y dle 2:1 dimetric. Z osa shodně s TILE_H (= 2*HALF_H), aby
// kostka 1×1×1 vypadala "jako kostka", ne placatě.
export const LOCAL_UNIT_X = HALF_W;       // 64 — 1 unit lokál → 64 px screen-x
export const LOCAL_UNIT_Y = HALF_H;       // 32 — 1 unit lokál → 32 px screen-y
export const LOCAL_UNIT_Z = TILE_H;       // 64 — 1 unit nahoru → 64 px screen-up

/**
 * Projekce lokálního 3D bodu do screen-space (relativně k recipe origin).
 *
 * Origin (0, 0, 0) → screen (0, 0). Pozitivní Z = nahoru (záporné screen Y).
 *
 * Vzorce 2:1 dimetric:
 *   sx = (x − y) × LOCAL_UNIT_X
 *   sy = (x + y) × LOCAL_UNIT_Y − z × LOCAL_UNIT_Z
 *
 * Vrací TUPLE [sx, sy] (ne objekt) — drobná úspora alokace v hot path při
 * pre-renderu recipe (volá se desítkykrát per primitive).
 */
export function project3d(x: number, y: number, z: number): [number, number] {
  const sx = (x - y) * LOCAL_UNIT_X;
  const sy = (x + y) * LOCAL_UNIT_Y - z * LOCAL_UNIT_Z;
  return [sx, sy];
}

// =============================================================================
// 3-tonal flat shading
// =============================================================================
// Slunce přichází z **left-up screen** (klasická iso pixel-art konvence).
// Boční stěny kostky / cylindru rozdělíme na "left face" (osvícenější) a
// "right face" (stínová). Top face je vždy nejsvětlejší.
//
// Implementace: **lerp k bílé / černé**, ne RGB násobení. Násobení ×1.5 na
// sytou barvu (např. 0xff0000) nemá efekt (komponenty se klampí na 255), kdežto
// lerp k bílé jasně rozjasní i sytou barvu. Pro low-poly look (kde basecolor
// bývá tmavá / sytá) je lerp výrazně viditelnější.
//
// Hodnoty:
//   LIGHTEN_AMOUNT = 0.35 — top face: 35 % cesty od basecolor k bílé
//   DARKEN_AMOUNT  = 0.50 — right face: 50 % cesty od basecolor k černé
//   left face = basecolor (= "mírně osvětlený default")
// =============================================================================

const LIGHTEN_AMOUNT = 0.35;
const DARKEN_AMOUNT  = 0.50;

/**
 * Lerp barvy ke bílé. amount=0 → original, amount=1 → bílá.
 *
 * Vzorec per kanál: out = c + amount * (255 - c).
 */
export function lightenToward(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >>  8) & 0xff;
  const b =  color        & 0xff;
  const rr = Math.floor(r + amount * (255 - r));
  const gg = Math.floor(g + amount * (255 - g));
  const bb = Math.floor(b + amount * (255 - b));
  return (rr << 16) | (gg << 8) | bb;
}

/**
 * Lerp barvy k černé. amount=0 → original, amount=1 → černá.
 *
 * Vzorec per kanál: out = c * (1 - amount).
 */
export function darkenToward(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >>  8) & 0xff;
  const b =  color        & 0xff;
  const factor = 1 - amount;
  const rr = Math.floor(r * factor);
  const gg = Math.floor(g * factor);
  const bb = Math.floor(b * factor);
  return (rr << 16) | (gg << 8) | bb;
}

/**
 * Generická "shade" funkce pro recipes — souznačná s ×factor (legacy API).
 * factor > 1 → lighten, factor < 1 → darken. Mapping na lerp:
 *   factor 1.10 → lighten 0.10
 *   factor 1.20 → lighten 0.20
 *   factor 0.75 → darken 0.25
 *   factor 0.50 → darken 0.50
 */
export function shade(color: number, factor: number): number {
  if (factor > 1) return lightenToward(color, factor - 1);
  if (factor < 1) return darkenToward(color, 1 - factor);
  return color;
}

/** Shortcut: nejsvětlejší tón pro top face (lerp ke bílé). */
export function shadeTop(color: number): number {
  return lightenToward(color, LIGHTEN_AMOUNT);
}

/** Shortcut: mid tón pro left/SW face (= basecolor, slunce ho ozařuje šikmo). */
export function shadeLeft(color: number): number {
  return color;
}

/** Shortcut: nejtmavší tón pro right/SE face (lerp k černé). */
export function shadeRight(color: number): number {
  return darkenToward(color, DARKEN_AMOUNT);
}
