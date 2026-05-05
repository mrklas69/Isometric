// =============================================================================
// BuildMode — UI/UX state pro režim stavby budov (Fáze 5.1 + 5.3).
//
// Drží:
//   - `active` (true/false) — je build mode zapnutý?
//   - `selectedTypeId` — který typ budovy stavíme (BUILDING_MINE / STORAGE)
//   - `ghost` — poloprůhledný Sprite, hovering preview na tile pod kurzorem
//
// `toggle(typeId)` semantika (Fáze 5.3):
//   - !active                → zapne, vybere typ
//   - active && current type → vypne (= "press same key again to exit")
//   - active && jiný typ     → switch na nový typ (= "press other key to swap")
//
// To umožňuje přepínat mezi mine/storage bez nutnosti Esc:
//   B → mine. N → switch na storage. N → exit. B → mine again.
//
// Toggle ON: ghost se zviditelní, tint se update dle validity (bílý = valid,
//            červený = invalid placement). Texture ghost se mění při switch
//            mezi typy.
// Toggle OFF: ghost se skryje, harvest mode dál funguje normálně.
//
// Volá se z input.ts:
//   - `toggle(typeId)` na klávesy B / N
//   - `updateGhost(screenX, screenY, valid)` při pohybu myši v build modu
//   - `hideGhost()` když kurzor opustí grid
//   - `exit()` na Esc / RMB klik bez dragu
// =============================================================================

import { Sprite } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { CachedSprite } from './render-cache.js';
import { BUILDING_MINE, BUILDING_TYPES } from './building.js';

// Vizuální parametry ghost preview.
const GHOST_ALPHA          = 0.55;       // poloprůhledný
const GHOST_TINT_VALID     = 0xffffff;   // bílá = base color (no tint)
const GHOST_TINT_INVALID   = 0xff6464;   // sytá červená = "nelze tady"

export class BuildMode {
  private active = false;
  // Aktuálně vybraný typ. Default MINE jen pro initial ghost texturu — než
  // uživatel stiskne B/N, build mode není aktivní, takže typ je vlastně neutral.
  private selectedTypeId: number = BUILDING_MINE;

  // Ghost sprite — žije v parent containeru (typicky world container).
  private readonly ghost: Sprite;

  // Cache reference — pro update ghost textury při změně selectedTypeId.
  private readonly buildingCache: ReadonlyArray<ReadonlyArray<CachedSprite>>;

  /**
   * @param parent          parent Container kam se přidá ghost (= world container,
   *                          aby se ghost transformoval s kamerou jako ostatní svět)
   * @param buildingCache   `CachedSprite[][]` z `buildTileCache(BUILDING_RECIPES)`
   */
  constructor(
    parent: Container,
    buildingCache: ReadonlyArray<ReadonlyArray<CachedSprite>>,
  ) {
    this.buildingCache = buildingCache;

    // Inicializace ghost sprite z cache prvního typu (MINE).
    const cached = this.lookupCache(this.selectedTypeId);
    this.ghost = new Sprite(cached.texture);
    this.ghost.anchor.set(cached.anchorX, cached.anchorY);
    this.ghost.alpha = GHOST_ALPHA;
    this.ghost.visible = false;
    parent.addChild(this.ghost);
  }

  /** Vrátí, jestli je build mode aktivní. Volá HUD pro display, input pro klik větvení. */
  isActive(): boolean {
    return this.active;
  }

  /** Vrátí typeId aktuálně vybraného typu budovy. */
  getSelectedType(): number {
    return this.selectedTypeId;
  }

  /** Vrátí jméno aktuálně vybraného typu (pro HUD). */
  getSelectedTypeName(): string {
    return BUILDING_TYPES[this.selectedTypeId]?.name ?? '?';
  }

  /**
   * Přepne build mode pro daný typ.
   *
   * Tří-stavová logika (Fáze 5.3):
   *   1. !active                 → zapni + vyber typ
   *   2. active, stejný typ      → vypni (idempotent toggle off)
   *   3. active, jiný typ        → switch ghost na nový typ, zůstaň aktivní
   *
   * Případ 3 umožňuje přepínat mezi mine/storage bez Esc — B → N → B → N
   * cycle bez vypnutí build módu.
   *
   * Caller musí poté zavolat updateGhost(...) na current hover, jinak ghost
   * zůstane na staré pozici (nebo skrytý) dokud uživatel nepohne myší.
   */
  toggle(typeId: number): void {
    if (this.active && this.selectedTypeId === typeId) {
      // Stejný typ podruhé → exit.
      this.exit();
      return;
    }
    // Buď !active → activate, nebo active s jiným typem → switch.
    this.active = true;
    this.setSelectedType(typeId);
  }

  /**
   * Změní vybraný typ a obnoví ghost texturu z cache. Privátní helper —
   * caller je toggle() (oba větvené případy "activate" a "switch").
   */
  private setSelectedType(typeId: number): void {
    this.selectedTypeId = typeId;
    const cached = this.lookupCache(typeId);
    // Pixi v8: sprite.texture lze za běhu měnit. Anchor je per-typ (anchor pozice
    // lokál (0,0,0) v textuře záleží na bounding boxu konkrétního recipe).
    this.ghost.texture = cached.texture;
    this.ghost.anchor.set(cached.anchorX, cached.anchorY);
  }

  /** Vypne build mode (volá Esc / RMB klik bez dragu). */
  exit(): void {
    this.active = false;
    this.ghost.visible = false;
  }

  /**
   * Update pozice + tint ghost sprite.
   *
   * Volá se z input.ts updateHover(). `screenX/Y` = world-space pozice
   * (= střed top diamond tile, kam by ghost měl přijít). `valid` = výsledek
   * canPlaceBuilding(...) pro hovered tile.
   *
   * Pokud build-mode není active, nic se neděje (ghost zůstává neviditelný).
   */
  updateGhost(screenX: number, screenY: number, valid: boolean): void {
    if (!this.active) {
      this.ghost.visible = false;
      return;
    }
    this.ghost.position.set(screenX, screenY);
    this.ghost.tint = valid ? GHOST_TINT_VALID : GHOST_TINT_INVALID;
    this.ghost.visible = true;
  }

  /** Skryje ghost — voláme když kurzor opustí grid. */
  hideGhost(): void {
    this.ghost.visible = false;
  }

  /** Lookup cache helper s explicitní chybovou hláškou. */
  private lookupCache(typeId: number): CachedSprite {
    const variants = this.buildingCache[typeId];
    if (!variants || !variants[0]) {
      throw new Error(`Chybí building cache pro typ ${typeId}`);
    }
    return variants[0];
  }
}
