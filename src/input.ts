// =============================================================================
// Input — klávesnice, myš, pickování dlaždice pod kurzorem.
//
// Klávesnice: WASD/šipky držené tlačítka (akumulované přes _keys flagy);
//             v každém frame kamera posune o (delta * speed).
// Myš:        - pravé/střední tlačítko + drag = pan kamery
//             - levé tlačítko = (zatím) jen update hover (pro budoucí klikání)
//             - kolečko = zoom kolem kurzoru
// Pickování:  každý pohyb myši přepočítá tile pod kurzorem (i, j) a aktualizuje
//             pozici highlight Graphics objektu.
// =============================================================================

import type { Camera } from './camera.js';
import type { Grid } from './grid.js';
import type { Container, Graphics } from 'pixi.js';
import { screenToTile, HALF_W, HALF_H, PIXELS_PER_LEVEL } from './iso.js';
import { GRID_SIZE, Z_MIN, Z_MAX } from './grid.js';

// Stisknuté klávesy — bool flagy, čteme je v každém frame.
// Pattern převzatý z PocketStory/Stickman (board.js _keys, BasicScene).
const _keys: Record<string, boolean> = {
  w: false, a: false, s: false, d: false,
  ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
};

// Rychlost klávesového panu v pixelech / sekundu (na zoomu 1).
// Při vyšším zoomu se ve world-souřadnicích pohybujeme pomaleji (víc detailů).
const KEY_PAN_SPEED = 600;

// Rychlost zoomu kolečkem — kolik per "tick" kolečka.
// 1.1 = +/- 10% per notch. Vyšší = agresivnější zoom.
const WHEEL_ZOOM_FACTOR = 1.12;

/** Veřejné API — to, co main.ts dostane po setupu. */
export type InputContext = {
  camera: Camera;
  grid: Grid;
  /** Container kam patří highlight (= world container, scale s zoomem). */
  worldContainer: Container;
  /** Highlight Graphics — nastavíme mu pozici nebo skryjeme. */
  highlight: Graphics;
  /** Element kde poslouchat eventy (canvas). */
  target: HTMLCanvasElement;
};

/**
 * Připojí všechny event listenery + vrátí update funkci, která se volá
 * každý frame (z app.ticker).
 *
 * Drag pan: stisk středového/pravého tlačítka začne drag, mousemove během dragu
 * posune target kamery, mouseup ukončí.
 */
export function setupInput(ctx: InputContext): (dt: number) => void {
  const { camera, grid, worldContainer, highlight, target } = ctx;

  // ── Klávesnice ──────────────────────────────────────────────────────────
  // Globální listener (window) — funguje i když není canvas focused.
  // Při tabování / Alt-Tab uvolníme všechny klávesy ('blur' event), jinak by
  // kamera "ujížděla" sama když se uživatel vrátí.
  window.addEventListener('keydown', (e) => {
    if (e.key in _keys) {
      _keys[e.key] = true;
    } else if (e.key.toLowerCase() in _keys) {
      _keys[e.key.toLowerCase()] = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key in _keys) {
      _keys[e.key] = false;
    } else if (e.key.toLowerCase() in _keys) {
      _keys[e.key.toLowerCase()] = false;
    }
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(_keys)) _keys[k] = false;
  });

  // ── Myš: pickování + hover ─────────────────────────────────────────────
  // Při každém pohybu spočteme world coord → tile (i, j) → highlight.
  let lastMouseX = 0;
  let lastMouseY = 0;

  function updateHover(screenX: number, screenY: number): void {
    lastMouseX = screenX;
    lastMouseY = screenY;

    const w = camera.screenToWorld(screenX, screenY);

    // ── Pickování s výškou (Fáze 2.1.7) ──────────────────────────────────
    // Princip: tile s výškou z má top corner posunutý NAHORU o z*PIXELS_PER_LEVEL
    // (= menší y). Pro virtuální flat-space pozici kurzoru posuneme y opačně
    // (+z*PIXELS_PER_LEVEL). screenToTile pak vrátí (i, j) jako kdyby tile byl
    // flat. Pokud skutečné tileHeight[i][j] === z, máme hit.
    //
    // Iterujeme z=Z_MAX → Z_MIN: první match (= nejvyšší tile pod kurzorem)
    // vyhrává. Tj. pokud výškový tile pokrývá nižší tile, vybereme výš.
    //
    // Edge case: kurzor uprostřed cliff face (= mezi top diamondy dvou tiles)
    // → žádný match → highlight.visible = false. Nemůžeme z cliff face určit
    // tile bez extra geometrie; KISS = na cliff face neřešíme.
    for (let z = Z_MAX; z >= Z_MIN; z--) {
      // tileToScreen vrací TOP corner; pro tile center posuň y o -HALF_H.
      const t = screenToTile(w.x, w.y + z * PIXELS_PER_LEVEL - HALF_H);
      const i = Math.round(t.i);
      const j = Math.round(t.j);
      if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) continue;
      if (grid.getHeightAt(i, j) !== z) continue;

      // Hit — tile (i, j) má výšku z a kurzor je nad jeho top diamondem.
      const sx = (i - j) * HALF_W;
      const sy = (i + j) * HALF_H - z * PIXELS_PER_LEVEL;
      highlight.position.set(sx, sy);
      highlight.visible = true;

      window.dispatchEvent(new CustomEvent('iso:hover', {
        detail: { i, j, z, name: grid.getNameAt(i, j) },
      }));
      return;
    }

    // Žádný tile pod kurzorem (mimo grid nebo nad cliff face).
    highlight.visible = false;
  }

  target.addEventListener('mousemove', (e) => {
    updateHover(e.clientX, e.clientY);

    // Drag pan — pokud držíme středové nebo pravé tlačítko.
    if (dragActive) {
      const dx = e.clientX - dragLastX;
      const dy = e.clientY - dragLastY;
      camera.pan(dx, dy);
      dragLastX = e.clientX;
      dragLastY = e.clientY;
    }
  });

  // ── Drag pan (pravé / středové tlačítko) ───────────────────────────────
  let dragActive = false;
  let dragLastX = 0;
  let dragLastY = 0;

  target.addEventListener('mousedown', (e) => {
    // 1 = středové tlačítko (kolečko), 2 = pravé. Levé (0) zatím rezervováno
    // pro budoucí klikání na dlaždice.
    if (e.button === 1 || e.button === 2) {
      dragActive = true;
      dragLastX = e.clientX;
      dragLastY = e.clientY;
      target.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  window.addEventListener('mouseup', () => {
    if (dragActive) {
      dragActive = false;
      target.style.cursor = 'default';
    }
  });

  // Vypnout default kontextové menu pravým tlačítkem (jinak by drag = menu).
  target.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── Kolečko: zoom ────────────────────────────────────────────────────
  target.addEventListener('wheel', (e) => {
    e.preventDefault();
    // deltaY < 0 = scroll nahoru = zoom in (přiblížit).
    const factor = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    camera.zoomAt(factor, e.clientX, e.clientY);

    // Po změně zoomu se hover bod změní (stejný kurzor = jiná tile).
    updateHover(e.clientX, e.clientY);
  }, { passive: false });

  // worldContainer reference — momentálně nepoužitá (highlight je dítě world
  // přes main.ts), ale ponecháno v API pro budoucí extension (např. picking
  // přes app.renderer.events). Tlumíme tak hlasité unused-warnings:
  void worldContainer;

  // ── Frame update ────────────────────────────────────────────────────
  return (dt: number) => {
    // Klávesy → směr panu. Inverze znaménka: WASD posune svět opačně
    // (W = svět dolů → kamera "vidí" výš).
    let dx = 0;
    let dy = 0;
    if (_keys.w || _keys.ArrowUp)    dy += 1;
    if (_keys.s || _keys.ArrowDown)  dy -= 1;
    if (_keys.a || _keys.ArrowLeft)  dx += 1;
    if (_keys.d || _keys.ArrowRight) dx -= 1;

    if (dx !== 0 || dy !== 0) {
      // Normalizace diagonály — bez tohoto by W+D byl 1.41× rychlejší než W.
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      camera.pan(dx * KEY_PAN_SPEED * dt, dy * KEY_PAN_SPEED * dt);

      // Při klávesovém pohybu se pod kurzorem mění world-coord → re-pick.
      updateHover(lastMouseX, lastMouseY);
    }
  };
}
