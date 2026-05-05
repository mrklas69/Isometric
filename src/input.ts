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
import type { Inventory } from './inventory.js';
import { RESOURCE_TYPES } from './resource.js';
import type { Sim, SpeedMultiplier } from './sim.js';
import type { BuildMode } from './build-mode.js';
import { canPlaceBuilding } from './building.js';

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
  /** Selection Graphics (Fáze 2.2.4) — persistentní vybraná tile. */
  selection: Graphics;
  /** Sdílený inventář — zapisuje se při sběru. */
  inventory: Inventory;
  /** Sim — přepínáme rychlost klávesami 0/1/2/3. */
  sim: Sim;
  /** Build mode (Fáze 5.1) — ghost preview + klik větvení. */
  buildMode: BuildMode;
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
  const { camera, grid, worldContainer, highlight, selection, inventory, sim, buildMode, target } = ctx;

  // Mapování klávesa → speed multiplier (Fáze 4).
  // Izomorfní řada 0/1/2/3 → 0×/1×/10×/100× (jeden způsob ovládání,
  // místo míchání Space + číslic).
  const SPEED_KEYS: Record<string, SpeedMultiplier> = {
    '0': 0,
    '1': 1,
    '2': 10,
    '3': 100,
  };

  // Vybraná tile (Fáze 2.2.4). null = nic vybráno → selection.visible = false.
  let selectedTile: { i: number; j: number; z: number } | null = null;

  /**
   * Pickování tile pod kurzorem (sdílený algoritmus pro hover i klik).
   * Iteruje z=Z_MAX → Z_MIN, vrací první tile, jehož top diamond pokrývá
   * (mouseX, mouseY) v jeho výšce. null = mimo grid nebo nad cliff face.
   */
  function pickTileAt(screenX: number, screenY: number): { i: number; j: number; z: number } | null {
    const w = camera.screenToWorld(screenX, screenY);
    for (let z = Z_MAX; z >= Z_MIN; z--) {
      const t = screenToTile(w.x, w.y + z * PIXELS_PER_LEVEL - HALF_H);
      const i = Math.round(t.i);
      const j = Math.round(t.j);
      if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) continue;
      if (grid.getHeightAt(i, j) !== z) continue;
      return { i, j, z };
    }
    return null;
  }

  /** Update selection Graphics dle aktuálního selectedTile. */
  function updateSelectionGraphic(): void {
    if (selectedTile === null) {
      selection.visible = false;
      return;
    }
    const { i, j, z } = selectedTile;
    selection.position.set((i - j) * HALF_W, (i + j) * HALF_H - z * PIXELS_PER_LEVEL);
    selection.visible = true;
  }

  // ── Klávesnice ──────────────────────────────────────────────────────────
  // Globální listener (window) — funguje i když není canvas focused.
  // Při tabování / Alt-Tab uvolníme všechny klávesy ('blur' event), jinak by
  // kamera "ujížděla" sama když se uživatel vrátí.
  window.addEventListener('keydown', (e) => {
    if (e.key in _keys) {
      _keys[e.key] = true;
    } else if (e.key.toLowerCase() in _keys) {
      _keys[e.key.toLowerCase()] = true;
    } else if (e.key === 'Escape') {
      // Esc: pokud build mode aktivní, vypni ho; jinak deselect (Fáze 2.2.4 + 5.1)
      if (buildMode.isActive()) {
        buildMode.exit();
      } else {
        selectedTile = null;
        updateSelectionGraphic();
      }
    } else if (e.key === 'b' || e.key === 'B') {
      // B = toggle build mode (Fáze 5.1)
      buildMode.toggle();
      // Po toggle update ghost na current hover (ON ukáže preview, OFF ho skryje
      // — updateGhost interně testuje isActive()).
      updateHover(lastMouseX, lastMouseY);
    } else if (e.key in SPEED_KEYS) {
      // Klávesy 0/1/2/3 → sim speed (Fáze 4)
      sim.setSpeed(SPEED_KEYS[e.key]);
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

    const tile = pickTileAt(screenX, screenY);
    if (tile === null) {
      highlight.visible = false;
      buildMode.hideGhost();
      return;
    }
    const { i, j, z } = tile;
    highlight.position.set((i - j) * HALF_W, (i + j) * HALF_H - z * PIXELS_PER_LEVEL);
    highlight.visible = true;

    // Build mode (Fáze 5.1): update ghost preview na hovered tile.
    // Ghost se umisťuje na střed top diamond (= +HALF_H), stejně jako resource
    // sprite — jejich anchor je v lokál (0, 0, 0) recipe = ground střed.
    if (buildMode.isActive()) {
      const valid = canPlaceBuilding(grid, i, j, buildMode.getSelectedType());
      const sx = (i - j) * HALF_W;
      const sy = (i + j) * HALF_H - z * PIXELS_PER_LEVEL + HALF_H;
      buildMode.updateGhost(sx, sy, valid);
    }

    window.dispatchEvent(new CustomEvent('iso:hover', {
      detail: { i, j, z, name: grid.getNameAt(i, j) },
    }));
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
      // Cumulative movement od mousedown — pro click vs drag detekci.
      const totalDx = e.clientX - dragStartX;
      const totalDy = e.clientY - dragStartY;
      if (Math.abs(totalDx) > DRAG_THRESHOLD_PX || Math.abs(totalDy) > DRAG_THRESHOLD_PX) {
        dragMoved = true;
      }
    }
  });

  // ── Drag pan (pravé / středové tlačítko) ───────────────────────────────
  // dragMoved + dragButton sledujeme proto, abychom rozlišili "klik bez dragu"
  // (= cesta uvolnit build mode přes RMB) od běžného drag pan. Threshold 4 px
  // brání mylné detekci dragu při drobném zachvění myši (typický UX práh).
  let dragActive = false;
  let dragLastX = 0;
  let dragLastY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragMoved = false;
  let dragButton = -1;
  const DRAG_THRESHOLD_PX = 4;

  target.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      // ── Levé tlačítko (Fáze 2.2.4 + 2.2.5 + 5.1) ────────────────────
      // Větvení: build mode → place budovu / harvest mode → sběr resource.
      const tile = pickTileAt(e.clientX, e.clientY);
      if (tile === null) {
        // Klik mimo grid: v harvest módu deselect; v build módu nic (ghost
        // už beztak nebyl vidět).
        if (!buildMode.isActive()) {
          selectedTile = null;
          updateSelectionGraphic();
        }
        return;
      }

      if (buildMode.isActive()) {
        // ── Build mode: pokus o placement ─────────────────────────
        // canPlaceBuilding je single source of truth pro validaci (sdílená
        // s ghost preview tint). Pokud invalid, ghost už byl červený → žádný
        // další feedback.
        const typeId = buildMode.getSelectedType();
        if (canPlaceBuilding(grid, tile.i, tile.j, typeId)) {
          grid.placeBuilding(typeId, tile.i, tile.j);
          // Po umístění je tile obsazený → ghost na něm musí přepnout na red.
          updateHover(e.clientX, e.clientY);
        }
        return;
      }

      // ── Harvest mode (default) ─────────────────────────────────
      // 1) Sběr resource (pokud na tile je) → inventář++.
      // 2) Selektor se přesune na klikntý tile (UX feedback i bez sběru).
      const harvested = grid.harvest(tile.i, tile.j);
      if (harvested !== null) {
        const def = RESOURCE_TYPES[harvested];
        if (def) {
          // Klíče Inventory jsou totožné s `name` v RESOURCE_TYPES — type
          // assertion je bezpečná dokud zachováme ekvivalenci.
          inventory[def.name as keyof Inventory]++;
        }
      }
      selectedTile = tile;
      updateSelectionGraphic();
    } else if (e.button === 1 || e.button === 2) {
      // Středové / pravé tlačítko = drag pan kamery (start).
      // Inicializace movement trackingu pro odlišení klik vs drag (viz mouseup).
      dragActive = true;
      dragMoved = false;
      dragButton = e.button;
      dragLastX = e.clientX;
      dragLastY = e.clientY;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      target.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  window.addEventListener('mouseup', () => {
    if (dragActive) {
      // RMB klik bez dragu (Fáze 5.1) — alternativní exit z build módu.
      // Threshold v DRAG_THRESHOLD_PX rozlišuje "klik" (= !dragMoved) od panu.
      if (!dragMoved && dragButton === 2 && buildMode.isActive()) {
        buildMode.exit();
      }
      dragActive = false;
      dragButton = -1;
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
