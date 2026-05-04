// =============================================================================
// Camera — pan + zoom + damping pro 2D PixiJS scénu.
//
// Vzor převzatý z PocketStory/Stickman (Three.js OrbitControls), ale
// přizpůsobený 2D izometrickému pohledu — žádná rotace, jen translation + zoom.
//
// Architektura: drží `target` stavy (kam se chce dostat) + `current` stavy
// (kde aktuálně je). Každý frame se current přibližuje k target přes
// exponenciální damping → plynulé doběhnutí, žádné škubání.
//
// Camera se aplikuje na `world` Container — posun a scale.
// =============================================================================

import type { Container } from 'pixi.js';

export type CameraOpts = {
  /** Container, který se transformuje (typicky `world` ve scéně). */
  world: Container;
  /** Šířka/výška viewportu pro centrování. */
  viewWidth: number;
  viewHeight: number;
  /** Počáteční zoom (1 = 100%). */
  initialZoom?: number;
  /** Min/max zoom (zabraňuje "ztracení se" při kolečkem). */
  minZoom?: number;
  maxZoom?: number;
};

export class Camera {
  // Cílové hodnoty — kam se kamera "chce" dostat (pohon vstupů: WASD, drag, wheel).
  private targetX = 0;
  private targetY = 0;
  private targetZoom: number;

  // Aktuální hodnoty — kde je teď (vykreslení). Doháněly se k target přes damping.
  private currentX = 0;
  private currentY = 0;
  private currentZoom: number;

  private readonly world: Container;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private viewWidth: number;
  private viewHeight: number;

  // Damping faktor (0..1). 0 = žádné doběhnutí (skok), 1 = nikdy nedoběhne.
  // 0.85 = svižné, ale viditelně plynulé. Pokud chceš ostřejší pohyb, sniž na 0.7.
  private readonly damping = 0.85;

  constructor(opts: CameraOpts) {
    this.world = opts.world;
    this.viewWidth = opts.viewWidth;
    this.viewHeight = opts.viewHeight;
    this.minZoom = opts.minZoom ?? 0.4;
    this.maxZoom = opts.maxZoom ?? 2.5;

    const z = opts.initialZoom ?? 1;
    this.targetZoom = z;
    this.currentZoom = z;
  }

  /** Posunout cíl kamery o delta v pixelech. WASD a drag volají tohle. */
  pan(dx: number, dy: number): void {
    this.targetX += dx;
    this.targetY += dy;
  }

  /**
   * Přiblížit/oddálit kolem bodu (typicky pozice kurzoru).
   * `factor` > 1 = zoom in, < 1 = zoom out. Bod (mouseX, mouseY) zůstává
   * pod kurzorem (= klasický behavioval mapových editorů).
   *
   * Math: cíl je takový, aby world-coord pod kurzorem zůstal stejný před i po
   * změně zoomu. Spočteme world bod, změníme zoom, dopočteme target offset.
   */
  zoomAt(factor: number, screenX: number, screenY: number): void {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * factor));
    if (newZoom === this.targetZoom) return;

    // World souřadnice bodu pod kurzorem PŘED změnou zoomu.
    // (screen = world * zoom + offset) → world = (screen - offset) / zoom
    const offsetX = this.viewWidth / 2 + this.targetX;
    const offsetY = this.viewHeight / 2 + this.targetY;
    const worldX = (screenX - offsetX) / this.targetZoom;
    const worldY = (screenY - offsetY) / this.targetZoom;

    // Aby pod kurzorem zůstal STEJNÝ world bod při novém zoomu, musíme
    // posunout target tak, aby: screen = world * newZoom + (viewCenter + newTarget)
    this.targetX = screenX - this.viewWidth / 2 - worldX * newZoom;
    this.targetY = screenY - this.viewHeight / 2 - worldY * newZoom;
    this.targetZoom = newZoom;
  }

  /**
   * Update volaný každý frame. `dt` je delta v sekundách (PixiJS ticker.deltaMS / 1000).
   *
   * Damping — `current = lerp(current, target, 1 - damping^(60*dt))`.
   * Násobení 60*dt zajišťuje frame-rate-independent rychlost (60 FPS = damping^1).
   */
  update(dt: number): void {
    const k = 1 - Math.pow(this.damping, 60 * dt);
    this.currentX += (this.targetX - this.currentX) * k;
    this.currentY += (this.targetY - this.currentY) * k;
    this.currentZoom += (this.targetZoom - this.currentZoom) * k;

    // Aplikace na svět: pozice = střed viewportu + camera offset, scale = zoom.
    this.world.position.set(
      this.viewWidth / 2 + this.currentX,
      this.viewHeight / 2 + this.currentY,
    );
    this.world.scale.set(this.currentZoom);
  }

  /** Reaguj na resize okna. */
  resize(viewWidth: number, viewHeight: number): void {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
  }

  /** Vrátí aktuální zoom (pro input.ts — drag rychlost potřebuje znát měřítko). */
  get zoom(): number {
    return this.currentZoom;
  }

  /**
   * Převede screen pixel souřadnice na world souřadnice (= souřadný systém,
   * ve kterém jsou umístěny dlaždice). Pro pickování.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.viewWidth / 2 - this.currentX) / this.currentZoom,
      y: (screenY - this.viewHeight / 2 - this.currentY) / this.currentZoom,
    };
  }
}
