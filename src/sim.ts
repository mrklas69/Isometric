// =============================================================================
// Sim — fixed-timestep tick smyčka pro game logiku.
//
// Render (PixiJS ticker) běží na monitor refresh rate (60+ FPS) a je čistě
// vizuální. Game logika (regenerace resource, výroba, doprava, ...) běží
// **nezávisle** na fixed tickrate, aby:
//   - rychlost hry nezávisela na FPS (vsync on/off, různé monitory),
//   - šlo později uložit/načíst stav (deterministické tick numbers),
//   - šel udělat replay / multiplayer (vše deterministické per tick).
//
// Algoritmus (Glenn Fiedler "Fix Your Timestep"):
//   1) Každý frame se volá sim.update(realDt).
//   2) accumulator += realDt * speedMultiplier.
//   3) Dokud accumulator >= TICK_INTERVAL: spusť 1 tick, accumulator -=.
//   4) Safety: max MAX_TICKS_PER_FRAME ticků za 1 frame (proti spirale of death,
//      kdy by sim trvala déle než tick interval a hra by se zasekla).
//
// Determinismus:
//   - Sim NIKDY nesahá na Math.random() ani performance.now().
//   - Vstupní data (tick number, herní stav) jsou jediné zdroje "náhody".
//   - Vše stochastické musí jít přes seedovaný RNG (až bude potřeba).
// =============================================================================

/**
 * Systém, který se zaregistruje do Sim a každý tick dostane callback.
 * Tick number je monotónně rostoucí — od bootu, nikdy se neresetuje.
 * Save/load později obnoví tickCount + stav, ne wall-clock time.
 */
export interface TickingSystem {
  tick(tickCount: number): void;
}

/** Cílový tickrate — 30 ticků za sekundu (~33.33 ms na tick). */
export const TPS = 30;

/** Délka jednoho ticku v ms. */
const TICK_INTERVAL_MS = 1000 / TPS;

/**
 * Kolik ticků smí Sim spustit v jednom frame, než se vzdá a "zahodí" zbytek.
 * Při speed 100× × 30 tps = 3000 ticks/s. Při 60 FPS = 50 ticks/frame —
 * tj. cap 60 nechá rezervu, aniž by spustil death spiral pokud sim přetížíme.
 *
 * Důsledek překročení: hra začne reálně běžet pomaleji než nastavený speed
 * (graceful degradation), místo aby se zasekla úplně.
 */
const MAX_TICKS_PER_FRAME = 60;

/** Možné hodnoty speed multiplikátoru. */
export type SpeedMultiplier = 0 | 1 | 10 | 100;

export class Sim {
  /** Monotónní čítač ticků od startu (nikdy neklesá, ani při pauze). */
  private tickCount = 0;

  /** 0 = pauza, 1 = normál, 10×, 100× rychlost. */
  private speed: SpeedMultiplier = 1;

  /** Ms reálného času čekající na zpracování (× speed). */
  private accumulator = 0;

  /** Registrované systémy — volány v pořadí registrace každý tick. */
  private readonly systems: TickingSystem[] = [];

  // ── Měřená TPS (pro HUD) ────────────────────────────────────────────
  // Počítáme ticky za poslední 1s okno. Reset přes performance.now()
  // je jediné místo v Sim, které sahá na wall-clock — ale jen pro
  // display, ne pro simulaci samotnou.
  private measuredTps = 0;
  private ticksSinceMeasure = 0;
  private lastMeasureMs = performance.now();

  /** Registruj systém pro tick callbacky. Volá se v pořadí registrace. */
  register(system: TickingSystem): void {
    this.systems.push(system);
  }

  /**
   * Volá se každý frame z PixiJS ticker.
   * @param realDt skutečný delta čas v sekundách (z app.ticker.deltaMS).
   */
  update(realDt: number): void {
    if (this.speed === 0) {
      // Pauza — accumulator se NEnasčítává, takže po unpause se ticky
      // nedoženou všechny najednou (co kdyby byl uživatel pauznutý hodinu).
      this.accumulator = 0;
      this.updateMeasureWindow();
      return;
    }

    // Přepočet sekundy → ms × speed multiplier.
    this.accumulator += realDt * 1000 * this.speed;

    let ticksThisFrame = 0;
    while (this.accumulator >= TICK_INTERVAL_MS && ticksThisFrame < MAX_TICKS_PER_FRAME) {
      this.runTick();
      this.accumulator -= TICK_INTERVAL_MS;
      ticksThisFrame++;
    }

    // Death-spiral cap: pokud jsme narazili na MAX_TICKS_PER_FRAME, zahoď
    // zbytek accumulatoru — jinak by se hromadil donekonečna a zatěžoval
    // i další framy. Lepší jeden "skok" v čase než lavina.
    if (ticksThisFrame === MAX_TICKS_PER_FRAME) {
      this.accumulator = 0;
    }

    this.updateMeasureWindow();
  }

  /** Spusť 1 tick — zavolej všechny systémy + inkrementuj čítač. */
  private runTick(): void {
    this.tickCount++;
    this.ticksSinceMeasure++;
    for (const sys of this.systems) {
      sys.tick(this.tickCount);
    }
  }

  /** Aktualizuj measured TPS jednou za sekundu (sliding window). */
  private updateMeasureWindow(): void {
    const now = performance.now();
    const elapsed = now - this.lastMeasureMs;
    if (elapsed >= 1000) {
      // Normalizace na ticks/sec (kdyby okno nebylo přesně 1000 ms).
      this.measuredTps = Math.round((this.ticksSinceMeasure * 1000) / elapsed);
      this.ticksSinceMeasure = 0;
      this.lastMeasureMs = now;
    }
  }

  // ── Veřejné gettery / settery ─────────────────────────────────────
  setSpeed(speed: SpeedMultiplier): void { this.speed = speed; }
  getSpeed(): SpeedMultiplier { return this.speed; }
  getTickCount(): number { return this.tickCount; }
  getMeasuredTps(): number { return this.measuredTps; }
  isPaused(): boolean { return this.speed === 0; }
}
