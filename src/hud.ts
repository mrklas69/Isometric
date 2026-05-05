// =============================================================================
// HUD — DOM overlay nad PixiJS canvasem.
//
// Pro MVP zobrazuje běžící časomíru (mm:ss) od startu hry. DOM místo PIXI textu
// → škáluje s prohlížečem nezávisle na world transformu, žádný extra ticker
// pro vykreslování (CSS to dělá zdarma).
//
// Hover info (tile pod kurzorem) se přidá k základnímu času — listener
// na custom event `iso:hover` z input.ts.
// =============================================================================

export class Hud {
  private readonly el: HTMLElement;
  private startTime = 0;       // ms timestamp začátku hry (performance.now())
  private hoverText = '';      // " | (3, 5) grass" nebo ""

  constructor(elementId: string) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`HUD element #${elementId} nenalezen`);
    this.el = el;

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
    // padStart — doplnění nuly zleva (1:5 → 01:05).
    const mm = String(min).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    this.el.textContent = `${mm}:${ss}${this.hoverText}`;
  }
}
