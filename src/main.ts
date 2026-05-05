// =============================================================================
// Entry point — kompozice všech modulů + PixiJS Application setup.
//
// Pořadí:
//   1. Inicializace PIXI.Application (v8 vyžaduje await app.init).
//   2. Vytvoření world Container (cíl kamery — pan/zoom transformuje jen ten).
//   3. Generování gridu (GRID_SIZE × GRID_SIZE dlaždic).
//   4. Highlight overlay nad gridem.
//   5. Camera + Input + HUD setup.
//   6. Animační smyčka přes app.ticker.
// =============================================================================

import { Application, Container } from 'pixi.js';
import { PAL } from './palette.js';
import { Grid } from './grid.js';
import { createHighlightGraphic, createSelectionGraphic } from './tiles.js';
import { Camera } from './camera.js';
import { setupInput } from './input.js';
import { Hud } from './hud.js';
import { createInventory } from './inventory.js';
import { buildTileCache } from './render-cache.js';
import { RESOURCE_RECIPES } from './recipes.js';
import { TILE_RECIPES } from './tile-recipes.js';
import { Sim } from './sim.js';

async function main(): Promise<void> {
  // ── PIXI Application ─────────────────────────────────────────────────
  // PixiJS v8 — Application se inicializuje async přes init(). Nový renderer
  // (WebGPU/WebGL2) si automaticky vybírá podle dostupnosti.
  const app = new Application();
  await app.init({
    background: PAL.bg,
    resizeTo: window,           // canvas se škáluje s oknem
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  // V PixiJS v8 se canvas přistupuje přes `app.canvas` (ne `app.view`).
  const root = document.getElementById('app');
  if (!root) throw new Error('#app element nenalezen');
  root.appendChild(app.canvas);

  // ── World Container ─────────────────────────────────────────────────
  // Vše, co camera transformuje, žije pod `world`. Stage zůstává staticky
  // v origin — tak můžeme jednoduše posunout/zoomovat celý svět najednou.
  const world = new Container();
  app.stage.addChild(world);

  // ── Render cache (Fáze 3.1 + 3.2) ────────────────────────────────
  // Pre-rendering všech recipes (tile typy + resources s variantami) do
  // RenderTexture. Pak per-tile sprite jen referuje texturu — GPU batch
  // friendly, low-poly 3D look. Stejná struktura cache (CachedSprite[][])
  // pro tile i resource → reuse jednoho builderu.
  //   - tileCache:     8 typů × 3 varianty = 24 textur
  //   - resourceCache: tree (5 variant) + stone (1) + iron (1) = 7 textur
  const tileCache     = buildTileCache(app.renderer, TILE_RECIPES);
  const resourceCache = buildTileCache(app.renderer, RESOURCE_RECIPES);

  // ── Grid ──────────────────────────────────────────────────────────
  // Seed je deterministický — chceš jinou mapu? Změň seed.
  // forceTypeId — pokud zadáno, všechny dlaždice stejného typu (debug).
  const SEED = 0x15ce7ec;
  const FORCE_TYPE: number | undefined = undefined;
  const grid = new Grid(SEED, tileCache, resourceCache, FORCE_TYPE);
  world.addChild(grid.container);

  // ── Selection (vybraná dlaždice) ──────────────────────────────────
  // Persistentní oranžový rámeček nad vybraným tile (left-click). Pod
  // highlight v render order — žlutý hover má přednost vizuálně.
  const selection = createSelectionGraphic(PAL.selection);
  selection.visible = false;
  world.addChild(selection);

  // ── Highlight pod kurzorem ────────────────────────────────────────
  // Žlutý rámeček nad běžnými dlaždicemi, skrytý dokud kurzor není nad gridem.
  const highlight = createHighlightGraphic(PAL.hover);
  highlight.visible = false;
  world.addChild(highlight);   // children grid + selection + highlight


  // ── Camera ────────────────────────────────────────────────────────
  // Počáteční offset: vycentrovat top-left corner gridu blíže ke středu okna.
  // Bez offsetu by (0,0) tile bylo přesně na středu, ale grid roste doprava-dolů,
  // takže kamera by viděla jen levou polovinu mapy.
  const camera = new Camera({
    world,
    viewWidth: app.canvas.width / (window.devicePixelRatio || 1),
    viewHeight: app.canvas.height / (window.devicePixelRatio || 1),
    initialZoom: 1,
    minZoom: 0.4,
    maxZoom: 2.5,
  });
  // Posunout kameru tak, aby grid začínal v levé části, ne přes střed:
  camera.pan(0, -200);

  // Reaguj na resize — Pixi resizuje canvas sám (resizeTo:window),
  // jen řekneme kameře nové rozměry.
  window.addEventListener('resize', () => {
    camera.resize(
      app.canvas.width / (window.devicePixelRatio || 1),
      app.canvas.height / (window.devicePixelRatio || 1),
    );
  });

  // ── Inventory (Fáze 2.2.6) ───────────────────────────────────────
  // Sdílený mutable objekt — input ho zapisuje při sběru, HUD ho čte
  // v každém frame.
  const inventory = createInventory();

  // ── Sim (Fáze 4) ─────────────────────────────────────────────────
  // Fixed-timestep tick smyčka pro game logiku, oddělená od rendereru.
  // Defaultní speed = 1× (30 tps). Klávesy 0/1/2/3 v input.ts přepínají
  // 0×/1×/10×/100×. Žádné systémy zatím — jen běží čítač pro HUD.
  const sim = new Sim();

  // ── Input ────────────────────────────────────────────────────────
  const inputUpdate = setupInput({
    camera,
    grid,
    worldContainer: world,
    highlight,
    selection,
    inventory,
    sim,
    target: app.canvas,
  });

  // ── HUD ──────────────────────────────────────────────────────────
  const hud = new Hud('hud', inventory, sim);

  // ── Animační smyčka ─────────────────────────────────────────────
  // PixiJS ticker volá callback ~60× za sekundu (resp. monitor refresh rate).
  // ticker.deltaMS je delta v milisekundách, převádíme na sekundy.
  app.ticker.add(() => {
    const dt = app.ticker.deltaMS / 1000;
    inputUpdate(dt);
    camera.update(dt);
    sim.update(dt);
    hud.update();
  });
}

main().catch((err) => {
  console.error('Fatal error při startu:', err);
});
