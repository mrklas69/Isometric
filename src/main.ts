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
import { createHighlightGraphic } from './tiles.js';
import { Camera } from './camera.js';
import { setupInput } from './input.js';
import { Hud } from './hud.js';
import { loadTileTextures } from './assets.js';
import { makeProceduralTextures } from './procedural.js';

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

  // ── Render mode ──────────────────────────────────────────────────
  // USE_GRAPHICS=true → procedurální PIXI.Graphics dlaždice (8 barev z palety,
  //                    konzistentní iso shape, žádné assety potřeba).
  // USE_GRAPHICS=false → sprite z PNG textury (vyžaduje konzistentní 2:1
  //                     dimetric shape napříč typy — atlas v1 NE, parkováno
  //                     do atlas v2 nebo manuálně malovaných dlaždic).
  // USE_PROCEDURAL_TEXTURES (relevantní jen pro sprite path) → debug fallback,
  //                     vygeneruje textury z Graphics místo PNG (= bezpečný
  //                     baseline pro test sprite render path).
  const USE_GRAPHICS = true;
  const USE_PROCEDURAL_TEXTURES = false;

  // Sprite path potřebuje textury, Graphics path je nepoužívá → ušetříme PNG
  // load + síťovou prodlevu, když textury nejsou potřeba.
  const textures: import('pixi.js').Texture[] = USE_GRAPHICS
    ? []
    : USE_PROCEDURAL_TEXTURES
      ? makeProceduralTextures(app)
      : await loadTileTextures();

  // ── Grid ──────────────────────────────────────────────────────────
  // Seed je deterministický — chceš jinou mapu? Změň seed.
  // forceTypeId — pokud zadáno, všechny dlaždice stejného typu (debug).
  const SEED = 0x15ce7ec;
  const FORCE_TYPE: number | undefined = undefined;
  const grid = new Grid(SEED, textures, FORCE_TYPE, USE_GRAPHICS);
  world.addChild(grid.container);

  // ── Highlight pod kurzorem ────────────────────────────────────────
  // Žlutý rámeček nad běžnými dlaždicemi, skrytý dokud kurzor není nad gridem.
  const highlight = createHighlightGraphic(PAL.hover);
  highlight.visible = false;
  world.addChild(highlight);   // children grid + highlight = highlight nad ním


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

  // ── Input ────────────────────────────────────────────────────────
  const inputUpdate = setupInput({
    camera,
    grid,
    worldContainer: world,
    highlight,
    target: app.canvas,
  });

  // ── HUD ──────────────────────────────────────────────────────────
  const hud = new Hud('hud');

  // ── Animační smyčka ─────────────────────────────────────────────
  // PixiJS ticker volá callback ~60× za sekundu (resp. monitor refresh rate).
  // ticker.deltaMS je delta v milisekundách, převádíme na sekundy.
  app.ticker.add(() => {
    const dt = app.ticker.deltaMS / 1000;
    inputUpdate(dt);
    camera.update(dt);
    hud.update();
  });
}

main().catch((err) => {
  console.error('Fatal error při startu:', err);
});
