// =============================================================================
// BuildMode — UI/UX state pro režim stavby budov (Fáze 5.1).
//
// Drží:
//   - `active` (true/false) — je build mode zapnutý?
//   - `selectedTypeId` — který typ budovy stavíme (BUILDING_MINE pro MVP)
//   - `ghost` — poloprůhledný Sprite, hovering preview na tile pod kurzorem
//
// Toggle ON: ghost se zviditelní, tint se update dle validity (zelený =
//            valid placement, červený = invalid).
// Toggle OFF: ghost se skryje, harvest mode dál funguje normálně.
//
// Volá se z input.ts:
//   - `toggle()` na klávesu B
//   - `updateGhost(screenX, screenY, valid)` při pohybu myši v build modu
//   - `hideGhost()` když kurzor opustí grid
//   - `exit()` na Esc
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
  // Pro MVP fixní typ. Až budeme mít víc typů, přidáme cycle / hotbar API.
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
   * Přepne build mode. Caller musí poté zavolat updateGhost(...) na current
   * hover, jinak ghost zůstane skrytý dokud uživatel nepohne myší.
   */
  toggle(): void {
    this.active = !this.active;
    if (!this.active) this.ghost.visible = false;
  }

  /** Vypne build mode (volá Esc). */
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
