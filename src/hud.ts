// =============================================================================
// HUD — DOM overlay nad PixiJS canvasem.
//
// Zobrazuje časomíru (mm:ss), hover info (tile pod kurzorem) a inventář
// (Fáze 2.2.6). DOM místo PIXI textu → škáluje s prohlížečem nezávisle
// na world transformu, žádný extra ticker pro vykreslování (CSS to dělá zdarma).
// =============================================================================

import type { Inventory } from './inventory.js';
import type { Sim } from './sim.js';
import { TPS } from './sim.js';
import type { BuildMode } from './build-mode.js';
import type { Grid } from './grid.js';
import { BUILDING_TYPES } from './building.js';
import { RESOURCE_TYPES } from './resource.js';

/** Snapshot hovered tile — drží se mezi mousemove a update tickem. */
type HoverState = { i: number; j: number; z: number; name: string | null };

export class Hud {
  private readonly el: HTMLElement;
  private readonly inventory: Inventory;   // sdílená reference (z main.ts)
  private readonly sim: Sim;               // sdílená reference (z main.ts)
  private readonly buildMode: BuildMode;   // sdílená reference (z main.ts)
  private readonly grid: Grid;             // pro live lookup building output
  private startTime = 0;       // ms timestamp začátku hry (performance.now())
  // Hover state: zapsaný eventem `iso:hover`, čtený v update(). Per-frame
  // přepočet building output (číslo musí růst, i když uživatel nehne myší).
  private hover: HoverState | null = null;

  constructor(
    elementId: string,
    inventory: Inventory,
    sim: Sim,
    buildMode: BuildMode,
    grid: Grid,
  ) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`HUD element #${elementId} nenalezen`);
    this.el = el;
    this.inventory = inventory;
    this.sim = sim;
    this.buildMode = buildMode;
    this.grid = grid;

    this.startTime = performance.now();

    // Listener — jen uloží snapshot. Skutečný display string skládá update().
    window.addEventListener('iso:hover', (e: Event) => {
      const ce = e as CustomEvent<HoverState>;
      this.hover = ce.detail;
    });
  }

  /** Volá se každý frame z hlavní animační smyčky. */
  update(): void {
    const elapsedMs = performance.now() - this.startTime;
    const totalSec = Math.floor(elapsedMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const mm = String(min).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');

    // Hover text se skládá per-frame (Fáze 5.2) — building output musí růst,
    // i když uživatel nehne myší. Lookup je O(1), nehraje roli na výkon.
    const hoverText = this.formatHover();

    // Inventář — čteme přímo ze sdíleného objektu (input.ts ho mutuje při sběru).
    const inv = this.inventory;
    const invText = ` | tree ${inv.tree} | iron ${inv.iron} | stone ${inv.stone}`;

    // Sim status (Fáze 4) — speed (× nebo PAUSED), tick count, measured TPS.
    // measured TPS bude často mírně < TPS i při normálu kvůli zaokrouhlení
    // okna; při 100× speed by mělo být ~3000.
    const speed = this.sim.getSpeed();
    const speedText = speed === 0 ? 'PAUSED' : `${speed}×`;
    const simText = ` | ${speedText} tick ${this.sim.getTickCount()} (${this.sim.getMeasuredTps()}/${TPS} tps)`;

    // Build mode (Fáze 5.1) — `BUILD: mine` viditelné jen když je active.
    const buildText = this.buildMode.isActive()
      ? ` | BUILD: ${this.buildMode.getSelectedTypeName()}`
      : '';

    this.el.textContent = `${mm}:${ss}${hoverText}${invText}${simText}${buildText}`;
  }

  /**
   * Sestaví hover část textu. Bez hover = ''. S hover = `(i, j) z=N name [building info]`.
   * Building info je live z Gridu — ukazuje aktuální output amount.
   */
  private formatHover(): string {
    if (!this.hover) return '';
    const { i, j, z, name } = this.hover;

    // Building info — jen když na tile budova stojí.
    const b = this.grid.getBuilding(i, j);
    let buildingPart = '';
    if (b) {
      const typeName = BUILDING_TYPES[b.typeId]?.name ?? '?';
      if (b.output) {
        const resName = RESOURCE_TYPES[b.output.type]?.name ?? '?';
        buildingPart = ` [${typeName}: ${resName} ${b.output.amount}/${b.output.capacity}]`;
      } else {
        buildingPart = ` [${typeName}]`;
      }
    }

    return ` | (${i}, ${j}) z=${z} ${name ?? '?'}${buildingPart}`;
  }
}
