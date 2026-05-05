// =============================================================================
// MineSystem — produkce v dolech (Fáze 5.2).
//
// First reálný TickingSystem nad Sim infrastrukturou z Fáze 4. Každých
// MINE_TICKS_PER_UNIT tiků projde všechny zaregistrované Mine budovy a
// inkrementuje jejich output.amount o 1 (cap na capacity).
//
// Determinismus:
//   - Iterace je v pořadí registrace (Map insertion order garantuje stejné
//     pořadí napříč běhy pro stejné `placeBuilding` posloupnosti).
//   - Žádné Math.random / performance.now → stejný save-load chování.
//
// Performance:
//   - Iterace přes všechny budovy každých 60 tiků = 0.5×/s (při 1× speed).
//   - Pro 1000 mines = 1000 iterací 0.5×/s = nehraje roli.
//   - Pro 100× speed = 50×/s × 1000 = 50k inkrementů/s = stále nic.
// =============================================================================

import type { TickingSystem } from './sim.js';
import type { Buildings } from './buildings.js';
import { BUILDING_MINE, MINE_TICKS_PER_UNIT } from './building.js';

export class MineSystem implements TickingSystem {
  private readonly buildings: Buildings;

  constructor(buildings: Buildings) {
    this.buildings = buildings;
  }

  tick(tickCount: number): void {
    // Rate-limit: produkce 1 unit / MINE_TICKS_PER_UNIT tiků. Modulo místo
    // per-building čítače = společný takt pro všechny doly (= izomorfní,
    // jednodušší debug). Důsledek: všechny mine "tikají" zároveň, ne v rozptylu.
    if (tickCount % MINE_TICKS_PER_UNIT !== 0) return;

    for (const b of this.buildings.all()) {
      if (b.typeId !== BUILDING_MINE) continue;
      if (b.output === null) continue;        // sanity, mine vždy má output
      if (b.output.amount >= b.output.capacity) continue;  // full → stagnuje
      b.output.amount++;
    }
  }
}
