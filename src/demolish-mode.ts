// =============================================================================
// DemolishMode — UI/UX state pro režim demolice budov (Fáze 5.5).
//
// Symetrický s BuildMode: oba jsou exclusive módy (jedno toggle = on/off),
// vstupují do harvest mode větvení v input.ts. Liší se ve vizuálu:
//
//   - BuildMode    : ghost sprite (poloprůhledný, hovering preview na tile)
//   - DemolishMode : tint existing building sprite (= cíl klik = červené barvení)
//
// Důvod rozdílu: BuildMode kreslí "co teprve bude" → potřebuje samostatný sprite.
// DemolishMode podsvěcuje "co už tam je" → modifikuje existing sprite tint.
//
// Bez ghost sprite = žádný parent Container parametr v konstruktoru, žádná
// správa života Pixi objektů. KISS oproti BuildMode.
//
// Mutual exclusion s BuildMode: input.ts při aktivaci jednoho módu vypíná druhý
// (DemolishMode neví o BuildMode a naopak — orchestrace je v inputu, izomorfně
// s tím, jak se přepínají typy v rámci BuildMode přes B/N).
// =============================================================================

import type { Grid } from './grid.js';

const TINT_DEFAULT  = 0xffffff;       // bílá = no tint (= výchozí stav sprite)
const TINT_DEMOLISH = 0xff5555;       // sytá červená = "klik = smaž"

export class DemolishMode {
  private active = false;
  // Aktuálně podsvícená budova — držíme (i, j) abychom mohli při změně cíle
  // (nebo exitu) obnovit původní tint. Bez tohoto by se "po opuštění" zachoval
  // červený nátěr a uživatel by viděl falešný cue.
  private hoverTarget: { i: number; j: number } | null = null;

  isActive(): boolean {
    return this.active;
  }

  /** Aktivuje demolish mode. Idempotentní — pokud už je active, nic se neděje. */
  enter(): void {
    if (this.active) return;
    this.active = true;
  }

  /**
   * Vypne demolish mode. Obnoví tint na případně podsvícené budově (jinak by
   * sprite zůstal červený i v harvest módu = bug).
   */
  exit(grid: Grid): void {
    if (!this.active) return;
    this.active = false;
    this.clearHoverTint(grid);
  }

  /** Toggle on/off. Volá input.ts na klávesu X. */
  toggle(grid: Grid): void {
    if (this.active) this.exit(grid);
    else this.enter();
  }

  /**
   * Update hover cíle (volá input.ts při mousemove). Pokud na (i, j) stojí
   * budova, podsvití ji červeně; jinak vyčistí předchozí podsvit.
   *
   * Logika "změna targetu" je v této metodě: jakákoliv změna `hoverTarget`
   * nejdřív obnoví předchozí tint, pak (volitelně) nastaví nový. Idle pohyb
   * po stejné budově = no-op (tint už je nastaven).
   */
  setHover(i: number, j: number, grid: Grid): void {
    if (!this.active) return;
    const buildingId = grid.getBuildingAt(i, j);
    const newTarget = buildingId !== null ? { i, j } : null;

    // Stále stejný target → nic. Reference compare nestačí (objekty jsou
    // freshly vyrobené), porovnám pole.
    const same =
      newTarget !== null && this.hoverTarget !== null &&
      newTarget.i === this.hoverTarget.i && newTarget.j === this.hoverTarget.j;
    if (same) return;
    if (newTarget === null && this.hoverTarget === null) return;

    // Změna — obnov předchozí, nastav nový.
    this.clearHoverTint(grid);
    if (newTarget !== null) {
      grid.setBuildingTint(newTarget.i, newTarget.j, TINT_DEMOLISH);
      this.hoverTarget = newTarget;
    }
  }

  /**
   * Vyčistí podsvit (volá input.ts když kurzor opustí grid). Bez tohoto by
   * tint zůstal na poslední budově dokud uživatel nehove jinou tile.
   */
  clearHover(grid: Grid): void {
    if (!this.active) return;
    this.clearHoverTint(grid);
  }

  /** Interní helper — obnoví tint na hoverTarget budově a target = null. */
  private clearHoverTint(grid: Grid): void {
    if (this.hoverTarget === null) return;
    grid.setBuildingTint(this.hoverTarget.i, this.hoverTarget.j, TINT_DEFAULT);
    this.hoverTarget = null;
  }

  /**
   * Klik v demolish módu — pokud na (i, j) stojí budova, smaže ji. Vrátí true
   * pokud byla budova odstraněna. Po úspěchu se hoverTarget vyresetuje (sprite
   * je destroyed, tint manipulation by házel na neexistující objekt).
   *
   * Demolish mode zůstává aktivní — uživatel může mazat víc budov v řadě.
   * Pro vystoupení musí stisknout X znovu / Esc.
   */
  confirmDemolish(i: number, j: number, grid: Grid): boolean {
    if (!this.active) return false;
    const buildingId = grid.getBuildingAt(i, j);
    if (buildingId === null) return false;
    // Reset hover state PŘED removeBuilding — sprite bude destroyed, takže
    // pozdější setBuildingTint by sice byl no-op (sprite už neexistuje), ale
    // čistší je nedržet stale referenci.
    this.hoverTarget = null;
    return grid.removeBuilding(buildingId);
  }
}
