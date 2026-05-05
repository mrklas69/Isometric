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

export class Hud {
  private readonly el: HTMLElement;
  private readonly inventory: Inventory;   // sdílená reference (z main.ts)
  private readonly sim: Sim;               // sdílená reference (z main.ts)
  private startTime = 0;       // ms timestamp začátku hry (performance.now())
  private hoverText = '';      // " | (3, 5) z=7 grass" nebo ""

  constructor(elementId: string, inventory: Inventory, sim: Sim) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`HUD element #${elementId} nenalezen`);
    this.el = el;
    this.inventory = inventory;
    this.sim = sim;

    this.startTime = performance.now();

    // Listener na hover info z input.ts.
    window.addEventListener('iso:hover', (e: Event) => {
      const ce = e as CustomEvent<{ i: number; j: number; z: number; name: string | null }>;
      const { i, j, z, name } = ce.detail;
      this.hoverText = ` | (${i}, ${j}) z=${z} ${name ?? '?'}`;
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

    // Inventář — čteme přímo ze sdíleného objektu (input.ts ho mutuje při sběru).
    const inv = this.inventory;
    const invText = ` | tree ${inv.tree} | iron ${inv.iron} | stone ${inv.stone}`;

    // Sim status (Fáze 4) — speed (× nebo PAUSED), tick count, measured TPS.
    // measured TPS bude často mírně < TPS i při normálu kvůli zaokrouhlení
    // okna; při 100× speed by mělo být ~3000.
    const speed = this.sim.getSpeed();
    const speedText = speed === 0 ? 'PAUSED' : `${speed}×`;
    const simText = ` | ${speedText} tick ${this.sim.getTickCount()} (${this.sim.getMeasuredTps()}/${TPS} tps)`;

    this.el.textContent = `${mm}:${ss}${this.hoverText}${invText}${simText}`;
  }
}
