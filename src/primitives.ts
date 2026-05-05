// =============================================================================
// Primitives — slovník 3D primitiv vykreslovaných do 2D iso projekce.
//
// Každá primitiva (cylinder, cone, sphere, blob) přijímá `Graphics` a parametry
// v lokálních 3D souřadnicích. Po projekci přes `iso3d.project3d` produkuje
// 2D polygons s 3-tonal flat shadingem (top/left/right face).
//
// Konvence:
//   - **cylinder** (kmen, sloup): vertikální, base v `cz`, top v `cz + h`.
//                                  3 polygons: top elipsa + boční stěna L + R.
//   - **cone**    (koruna stromu, špice): vertikální, base v `cz`, apex v
//                                  `cz + h`. 2 polygons (L + R polovina troj-
//                                  úhelníku po projekci).
//   - **sphere**  (oblak, listoví, head): kulová polokoule "horní/spodní"
//                                  jako 2 polygons.
//   - **blob**    (kámen, ruda): 1 nepravidelný polygon ve `vertices` → caller
//                                volí barvu (= jeho 3-tonal odstín). Inter-blob
//                                variace dává objem (jako TheCubes ROCK).
//
// 3-tonal lighting: slunce z left-up screen.
//   top   face → shadeTop  (×1.20, highlight)
//   left  face → shadeLeft (×1.00, basecolor)
//   right face → shadeRight (×0.65, shadow)
//
// Polygons jsou kresleny v pořadí volání → caller (recipe) je odpovědný za
// správné back-to-front pořadí v rámci recipe (kmen před korunou, atd.).
// =============================================================================

import { Graphics } from 'pixi.js';
import {
  project3d,
  shadeTop, shadeLeft, shadeRight,
  darkenToward,
  LOCAL_UNIT_X, LOCAL_UNIT_Y, LOCAL_UNIT_Z,
} from './iso3d.js';

// √2 dosazené z analýzy iso projekce kruhu: maximum extrémních screen souřadnic
// bodu na iso kruhu o radius `r` je `r * LOCAL_UNIT_* * √2` (extrém v `t = ±π/4`).
const SQRT2 = Math.SQRT2;

// =============================================================================
// Cylinder — vertikální válec (kmen stromu, sloup, postava torso)
// =============================================================================

export type CylinderParams = {
  readonly kind: 'cylinder';
  readonly cx: number;     // X střed base v lokálních units
  readonly cy: number;     // Y střed base
  readonly cz: number;     // Z báze (typicky 0 pro objekt na zemi)
  readonly r: number;      // radius v lokálních units
  readonly h: number;      // výška v lokálních units
  readonly color: number;  // basecolor (3-tonal se odvodí)
};

function drawCylinder(g: Graphics, p: CylinderParams): void {
  // Screen radius spodní/vrchní elipsy (stejné — cylindr má konstantní r).
  const rx = p.r * LOCAL_UNIT_X * SQRT2;
  const ry = p.r * LOCAL_UNIT_Y * SQRT2;

  // Projekce base + top center. Pro čistě vertikální cylinder bcx == tcx.
  const [bcx, bcy] = project3d(p.cx, p.cy, p.cz);
  const [tcx, tcy] = project3d(p.cx, p.cy, p.cz + p.h);

  // --- Boční stěna ---
  // Pravou polovinu (= shadow side) kreslíme první: rectangle (bottom-center →
  // bottom-right → top-right → top-center). Slunce z left-up screen → right
  // face je ve stínu.
  g.poly([
    bcx,       bcy,
    bcx + rx,  bcy,
    tcx + rx,  tcy,
    tcx,       tcy,
  ]).fill(shadeRight(p.color));

  // Levá polovina (= mid side, basecolor)
  g.poly([
    bcx - rx,  bcy,
    bcx,       bcy,
    tcx,       tcy,
    tcx - rx,  tcy,
  ]).fill(shadeLeft(p.color));

  // --- Top cap ---
  // Pixi `ellipse(cx, cy, rx, ry)` kreslí elipsu se středem v (cx, cy).
  g.ellipse(tcx, tcy, rx, ry).fill(shadeTop(p.color));
}

// =============================================================================
// Cone — vertikální kužel (koruna stromu, špice, helma)
// =============================================================================

export type ConeParams = {
  readonly kind: 'cone';
  readonly cx: number; readonly cy: number; readonly cz: number;
  readonly r: number;     // radius base
  readonly h: number;     // výška (apex v cz + h)
  readonly color: number;
};

function drawCone(g: Graphics, p: ConeParams): void {
  const rx = p.r * LOCAL_UNIT_X * SQRT2;
  const [acx, acy] = project3d(p.cx, p.cy, p.cz + p.h);
  const [bcx, bcy] = project3d(p.cx, p.cy, p.cz);

  // Pravá polovina trojúhelníku (= shadow): apex → base-right → base-center.
  g.poly([
    acx,       acy,
    bcx + rx,  bcy,
    bcx,       bcy,
  ]).fill(shadeRight(p.color));

  // Levá polovina (= mid): apex → base-center → base-left.
  g.poly([
    acx,       acy,
    bcx,       bcy,
    bcx - rx,  bcy,
  ]).fill(shadeLeft(p.color));

  // Top highlight — úzký trojúhelník u apex v light tónu (= "ozářená špička").
  // Šířka 25 % base radius, výška 35 % height. Vystoupí jako jasný stripe na
  // vrchu cone → 3-tonal efekt místo 2-tonal "dva trojúhelníky lepené".
  const highlightHalfWidth = rx * 0.25;
  const highlightBaseY = acy + (bcy - acy) * 0.35;
  g.poly([
    acx,                       acy,
    acx + highlightHalfWidth,  highlightBaseY,
    acx - highlightHalfWidth,  highlightBaseY,
  ]).fill(shadeTop(p.color));
}

// =============================================================================
// Sphere — koule (oblak, listoví, hlava)
// =============================================================================

export type SphereParams = {
  readonly kind: 'sphere';
  readonly cx: number; readonly cy: number; readonly cz: number;
  readonly r: number;
  readonly color: number;
};

// Aproximace půlkoule: 16 segmentů na oblouku — pro low-poly look je to dost
// hladké, vizuální rozdíl od pravé elipsy nepostižitelný.
const SPHERE_ARC_SEGMENTS = 16;

function drawSphere(g: Graphics, p: SphereParams): void {
  // Sphere v iso projekci je téměř kruh (extrémy: 64*r horizontálně přes střed,
  // 64*r vertikálně) — kompromis na 1 hodnotu radius drží "kulový" pocit.
  const radius = p.r * LOCAL_UNIT_Z;
  const [scx, scy] = project3d(p.cx, p.cy, p.cz);

  // Plný kruh v midcolor jako podklad (top polovina se přepíše).
  g.circle(scx, scy, radius).fill(shadeLeft(p.color));

  // Top polokoule — polygon: levý-průměr-bod → oblouk přes top → pravý-průměr-bod.
  // Body parametrizované t ∈ [π, 2π]: `cos(t) ∈ [-1, 1]`, `sin(t) ∈ [-1, 0]`
  // (= screen Y nahoru). Polygon Pixi auto-uzavírá chordem vpravo→vlevo.
  const pts: number[] = [];
  for (let i = 0; i <= SPHERE_ARC_SEGMENTS; i++) {
    const t = Math.PI + (i / SPHERE_ARC_SEGMENTS) * Math.PI;  // π → 2π
    pts.push(scx + radius * Math.cos(t));
    pts.push(scy + radius * Math.sin(t));
  }
  g.poly(pts).fill(shadeTop(p.color));
}

// =============================================================================
// Blob — nepravidelný polygon (kámen, ruda)
// =============================================================================

export type BlobParams = {
  readonly kind: 'blob';
  readonly cx: number; readonly cy: number; readonly cz: number;
  // Vrcholy v lokálních 3D offsetech od (cx, cy, cz). Pořadí = obvod polygonu
  // (CW / CCW jak chce caller). Min 3 body.
  readonly vertices: ReadonlyArray<readonly [number, number, number]>;
  // Caller volí konkrétní odstín (light/mid/dark) — inter-blob variace dává
  // objem celku (jako TheCubes ROCK 5× icosahedron s 3 různými materiály).
  readonly color: number;
};

function drawBlob(g: Graphics, p: BlobParams): void {
  const pts: number[] = [];
  for (const [vx, vy, vz] of p.vertices) {
    const [sx, sy] = project3d(p.cx + vx, p.cy + vy, p.cz + vz);
    pts.push(sx, sy);
  }
  g.poly(pts).fill(p.color);
}

// =============================================================================
// Diamond — top tile face (= base barva tile na ground plane).
// =============================================================================
//
// 4-vrcholový kosočtverec na ground (z=0), pokrývá celé tile. Vrcholy jsou
// na lokálních souřadnicích:
//   top    = (-0.5, -0.5, 0) → screen ( 0, -32) (= top corner tile)
//   right  = (+0.5, -0.5, 0) → screen (+64,  0)
//   bottom = (+0.5, +0.5, 0) → screen ( 0, +32) (= bottom corner tile)
//   left   = (-0.5, +0.5, 0) → screen (-64,  0)
//
// Recipe origin (0, 0, 0) = STŘED tile na ground → diamond se kreslí kolem ní.
// Tenká tmavá hraně dává tile vizuální oddělení od sousedů (aniž bychom
// potřebovali světlou outline).
// =============================================================================

export type DiamondParams = {
  readonly kind: 'diamond';
  readonly color: number;
  readonly edgeAlpha?: number;   // 0..1, alpha tmavé hrany. Default 0.35.
};

const DIAMOND_DEFAULT_EDGE_ALPHA = 0.35;

function drawDiamond(g: Graphics, p: DiamondParams): void {
  const [tx, ty] = project3d(-0.5, -0.5, 0);
  const [rx, ry] = project3d( 0.5, -0.5, 0);
  const [bx, by] = project3d( 0.5,  0.5, 0);
  const [lx, ly] = project3d(-0.5,  0.5, 0);

  // Body diamondu — base color fill.
  g.poly([tx, ty, rx, ry, bx, by, lx, ly]).fill(p.color);

  // Tmavá hraně pro definici tile (= "kresba okrajů"). Ne fully opaque —
  // alpha 0.35 dává jemný highlight, aniž by edge "křičela".
  const edgeColor = darkenToward(p.color, 0.5);
  const edgeAlpha = p.edgeAlpha ?? DIAMOND_DEFAULT_EDGE_ALPHA;
  g.poly([tx, ty, rx, ry, bx, by, lx, ly])
    .stroke({ color: edgeColor, width: 1, alpha: edgeAlpha });
}

// =============================================================================
// Shadow — kontaktní stín pod objektem (= "ground shadow", AO feel).
// =============================================================================
//
// Tmavá elipsa s alpha na ground plane (z = 0). Standardní iso pixel-art
// technika: vrhá objekt na zem → silný 3D pocit, "objekt opravdu stojí".
// Použít jako PRVNÍ primitiv v recipe — vykreslí se pod ostatními (= správné
// vrstvení).
//
// Velikost = footprint objektu (= radius nejširší části). Alpha default 0.4
// (transparentní stín, drží barvu tile pod sebou prosvítající).
// =============================================================================

export type ShadowParams = {
  readonly kind: 'shadow';
  readonly cx: number; readonly cy: number;
  readonly r: number;        // radius v lokálních units (= footprint objektu)
  readonly alpha?: number;   // 0..1, default 0.4
};

const SHADOW_DEFAULT_ALPHA = 0.4;

function drawShadow(g: Graphics, p: ShadowParams): void {
  // Stín je elipsa na ground (z=0). Stejné rx/ry jako iso kruh.
  const rx = p.r * LOCAL_UNIT_X * SQRT2;
  const ry = p.r * LOCAL_UNIT_Y * SQRT2;
  const [scx, scy] = project3d(p.cx, p.cy, 0);
  const alpha = p.alpha ?? SHADOW_DEFAULT_ALPHA;
  g.ellipse(scx, scy, rx, ry).fill({ color: 0x000000, alpha });
}

// =============================================================================
// Dispatch + typy
// =============================================================================

export type Primitive =
  | DiamondParams
  | ShadowParams
  | CylinderParams
  | ConeParams
  | SphereParams
  | BlobParams;

/** Recipe = pole primitiv v render pořadí (back-to-front, caller responsible). */
export type Recipe = ReadonlyArray<Primitive>;

/** Vykreslí jednu primitivu do daného Graphics objektu. */
export function drawPrimitive(g: Graphics, p: Primitive): void {
  switch (p.kind) {
    case 'diamond':  drawDiamond(g, p); break;
    case 'shadow':   drawShadow(g, p); break;
    case 'cylinder': drawCylinder(g, p); break;
    case 'cone':     drawCone(g, p); break;
    case 'sphere':   drawSphere(g, p); break;
    case 'blob':     drawBlob(g, p); break;
  }
}

/** Vykreslí celý recipe (všechny primitivy) do Graphics. */
export function drawRecipe(g: Graphics, recipe: Recipe): void {
  for (const p of recipe) drawPrimitive(g, p);
}
