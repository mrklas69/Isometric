// =============================================================================
// Grid — datový + render layer pro mřížku 10×10.
//
// Drží 2D pole typeId (TILE_TYPES.id), generované deterministicky ze seedu
// (= stejná mapa při každém reloadu). Vykreslí všechny dlaždice jako sprity
// (z PNG textur načtených přes assets.ts) do PIXI.Container, který camera
// následně transformuje (pan/zoom).
// =============================================================================

import { Container, Texture } from 'pixi.js';
import type { Sprite, Graphics } from 'pixi.js';
import { TILE_TYPES } from './palette.js';
import { tileToScreen } from './iso.js';
import { createTileSprite, createTileGraphic } from './tiles.js';

// Velikost mřížky pro MVP. Kdykoliv změníš, přepočti i mapu (re-seed).
export const GRID_SIZE = 10;

/**
 * Mulberry32 — jednoduchý deterministický PRNG.
 * Vstup: 32-bit seed. Výstup: funkce vracející float [0, 1).
 *
 * Proč ne Math.random() — ten není seedovatelný a dvě reloady by daly jinou mapu.
 * Mulberry32 je veřejná doména, ~12 řádků kódu, kvalitně rozdělené pseudonáhodné
 * čísla pro herní použití.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;   // donutíme na unsigned 32-bit
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Grid {
  /** Container, do kterého se kreslí všechny dlaždice. Camera ho transformuje. */
  readonly container: Container;

  /** 2D pole typeId — `tileType[i][j]`. */
  readonly tileType: number[][];

  /** Lookup display object per tile (Sprite NEBO Graphics dle render mode). */
  private readonly tileSprites: (Sprite | Graphics)[][];

  /**
   * @param seed         deterministický seed pro náhodné rozhožení tile typů
   * @param textures     pole tile textur (index = TILE_TYPES.id), z assets.ts
   * @param forceTypeId  pokud zadáno, VŠECHNY dlaždice budou tohoto typu
   *                     (debug — pro odhalení nesouladu mezi sprite metadaty)
   * @param useGraphics  pokud true, použij PIXI.Graphics místo Sprite
   *                     (debug — vyloučí texture/anchor render path)
   */
  constructor(seed: number, textures: Texture[], forceTypeId?: number, useGraphics?: boolean) {
    this.container = new Container();
    // sortableChildren = false — pořadí addChild() určuje z-order. Renderujeme
    // dlaždice "zezadu dopředu" (j+i ascending), takže je default order OK.
    this.container.sortableChildren = false;

    const rand = mulberry32(seed);
    const numTypes = TILE_TYPES.length;

    // Inicializace 2D polí.
    this.tileType = [];
    this.tileSprites = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      this.tileType[i] = [];
      this.tileSprites[i] = [];
    }

    // Iterace v pořadí (i+j) ASC — to je correct z-order pro izometrii.
    // Tj. nejprve (0,0), pak (1,0)+(0,1), pak (2,0)+(1,1)+(0,2), atd.
    // Sprity přidávané později leží nad těmi předchozími — boční stěny "vyšších"
    // (i+j) dlaždic překryjí "nižší" jak má být.
    for (let sum = 0; sum < 2 * GRID_SIZE - 1; sum++) {
      for (let i = 0; i < GRID_SIZE; i++) {
        const j = sum - i;
        if (j < 0 || j >= GRID_SIZE) continue;

        const typeId = forceTypeId ?? Math.floor(rand() * numTypes);
        this.tileType[i]![j] = typeId;

        const obj = useGraphics
          ? createTileGraphic(typeId)
          : createTileSprite(typeId, textures);
        const { x, y } = tileToScreen(i, j);
        obj.position.set(x, y);
        this.container.addChild(obj);
        this.tileSprites[i]![j] = obj;
      }
    }
  }

  /** Bezpečný getter — vrátí typeId nebo null pokud je tile mimo mřížku. */
  getTypeAt(i: number, j: number): number | null {
    if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) return null;
    return this.tileType[i]?.[j] ?? null;
  }

  /** Vrátí jméno typu dlaždice (pro debug HUD). */
  getNameAt(i: number, j: number): string | null {
    const id = this.getTypeAt(i, j);
    if (id === null) return null;
    return TILE_TYPES[id]?.name ?? null;
  }
}
