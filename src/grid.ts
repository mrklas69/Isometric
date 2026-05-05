// =============================================================================
// Grid — datový + render layer pro mřížku GRID_SIZE × GRID_SIZE.
//
// Drží 2D pole `tileHeight` (z ∈ [Z_MIN, Z_MAX]) + `tileType` (TILE_TYPES.id).
// Obojí generováno deterministicky ze seedu (= stejná mapa při každém reloadu):
//   - výška: 2-oktávový value-noise (signedNoise2D)
//   - typ:   funkce výšky + per-tile hash variace (heightToTileType)
// Vykreslí všechny dlaždice jako sprity / Graphics do PIXI.Container, který
// camera následně transformuje (pan/zoom).
// =============================================================================

import { Container, Texture } from 'pixi.js';
import type { Sprite, Graphics } from 'pixi.js';
import { TILE_TYPES } from './palette.js';
import { RESOURCE_TREE, RESOURCE_IRON, RESOURCE_STONE } from './resource.js';
import { tileToScreen, PIXELS_PER_LEVEL } from './iso.js';
import { createTileSprite, createTileGraphic, createResourceOverlay } from './tiles.js';
import { signedNoise2D, hash2 } from './noise.js';

// =============================================================================
// Mapping height + (i, j) → tile type.
//
// Pásma (Z_MAX = 23):
//   z 0–5   → water (hluboká + mělká)
//   z 6     → wetlands (pobřeží; 'sand' tile type zatím není v palette)
//   z 7–13  → grass (70 %) / forest (20 %) / farmland (10 %) — variace
//   z 14–19 → hills (80 %) / dirt (20 %)
//   z 20–23 → mountain (vysoké hory)
//
// Variace uvnitř pásem jsou deterministicky picked z hash2(i, j, seed) — stejný
// (i, j, seed) vždy stejný typ, ale bez vzoru (žádné pruhy).
// =============================================================================

// typeId konstanty — používáme indexy z TILE_TYPES (palette.ts). Drží jméno
// na jednom místě, kdyby se id v paletě někdy změnily, najdeme to grepem.
const TYPE_GRASS    = 0;
const TYPE_DIRT     = 1;
const TYPE_WATER    = 2;
const TYPE_FARMLAND = 3;
const TYPE_FOREST   = 4;
const TYPE_MOUNTAIN = 5;
const TYPE_HILLS    = 6;
const TYPE_WETLANDS = 7;

// Variační noise XOR mask — různé seedy pro různé "vrstvy" výběru.
// Bez XOR by všechny vrstvy generovaly stejnou sekvenci.
const VARIATION_SEED_XOR = 0x5a5a5a5a;
const RESOURCE_SEED_XOR  = 0x3c3c3c3c;

function heightToTileType(z: number, i: number, j: number, seed: number): number {
  // Hash variace v rozsahu [0, 1) — deterministicky závisí na (i, j, seed).
  const v = hash2(i, j, seed ^ VARIATION_SEED_XOR);

  if (z <= 5) return TYPE_WATER;        // 0–5 hluboká + mělká voda
  if (z === 6) return TYPE_WETLANDS;    // pobřežní pás
  if (z <= 13) {
    // 7–13 grass pásmo s variací
    if (v < 0.70) return TYPE_GRASS;
    if (v < 0.90) return TYPE_FOREST;
    return TYPE_FARMLAND;
  }
  if (z <= 19) {
    // 14–19 hills pásmo s variací
    if (v < 0.80) return TYPE_HILLS;
    return TYPE_DIRT;
  }
  return TYPE_MOUNTAIN;                 // 20–23 vysoké hory
}

// =============================================================================
// Mapping (z, cliffMagnitude, i, j) → resource type | null  (Fáze 2.2.2)
//
// Pravidla (cíl ~25 % hustota na vhodných tile typech):
//   - iron na mountain (z ≥ 20):       40 %
//   - stone na cliff tiles (Δz ≥ 3):   25 %  ← prioritou nad tree
//   - tree na grass/hills (z 7–19):    25 %
//
// Cliff má prioritu nad tree → na strmém svahu hilly tile dostaneš `stone`,
// ne `tree` (sémanticky: na svahu kámen, na rovině strom). Iron jen na vrcholech.
// =============================================================================
function generateResource(
  z: number,
  cliffMagnitude: number,   // max(cliffRight, cliffLeft) v levels (ne pixelech)
  i: number,
  j: number,
  seed: number,
): number | null {
  // Per-tile deterministický hash [0, 1) pro density check.
  const v = hash2(i, j, seed ^ RESOURCE_SEED_XOR);

  if (z >= 20) {
    return v < 0.40 ? RESOURCE_IRON : null;
  }
  if (cliffMagnitude >= 3 && z >= 7) {
    // Cliff tile (= strmý svah) → kámen. Z ≥ 7 vyloučí cliffs ve vodě.
    return v < 0.25 ? RESOURCE_STONE : null;
  }
  if (z >= 7 && z <= 19) {
    return v < 0.25 ? RESOURCE_TREE : null;
  }
  return null;
}

// Velikost mřížky. Kdykoliv změníš, mapa se přegeneruje ze seedu.
// Pozor: počet dlaždic roste kvadraticky (100×100 = 10 000).
export const GRID_SIZE = 100;

// =============================================================================
// Výškový model — Fáze 2.1
// =============================================================================
// Terasovitý height: každý tile má integer z ∈ [Z_MIN, Z_MAX]. Mezi sousedy
// s rozdílným z se později (krok 2.1.5) vykreslí cliff face. Generátor je
// 2-oktávový value-noise (low-freq big features + high-freq detail).
//
// Aktuální parametry: rozsah 0–23 (~3× tile width = 184 px max výška),
// smooth bigger varianta — větší amplituda pro dramatičtější rolling hills,
// stále smooth (žádné quantize/terraces). Cliff faces zůstávají úzké
// (1–2 levels mezi sousedy), max výška mountain vůči water = 23·8 = 184 px.
// =============================================================================
export const Z_MIN = 0;
export const Z_MAX = 23;
export const Z_BASE = 12;       // střed range — flat svět by byl všude na 12 (low grass)
export const Z_LO_AMP = 11;     // amplituda velkých tvarů (širší = víc extrémů)
export const Z_HI_AMP = 3;      // amplituda jemných nerovností
export const Z_LO_FREQ = 0.05;  // ~1 perioda na 20 tile (kontinenty / pohoří)
export const Z_HI_FREQ = 0.20;  // ~1 perioda na 5 tile (drobné nerovnosti)

export class Grid {
  /** Container, do kterého se kreslí všechny dlaždice. Camera ho transformuje. */
  readonly container: Container;

  /** 2D pole typeId — `tileType[i][j]`. */
  readonly tileType: number[][];

  /** 2D pole výšky — `tileHeight[i][j]`, integer ∈ [Z_MIN, Z_MAX]. */
  readonly tileHeight: number[][];

  /**
   * 2D pole resource — `tileResource[i][j]` = id v `RESOURCE_TYPES`, nebo `null`
   * pokud na tile žádný resource není. Sběr (`harvest`) ho přepne na null.
   */
  readonly tileResource: (number | null)[][];

  /** Lookup display object per tile (Sprite NEBO Graphics dle render mode). */
  private readonly tileSprites: (Sprite | Graphics)[][];

  /**
   * Lookup overlay Graphics per tile (resource ikona) — null pokud tile nemá
   * resource. Při sběru `destroy()` + nastav null.
   */
  private readonly tileResourceOverlay: (Graphics | null)[][];

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

    // Inicializace 2D polí.
    this.tileType = [];
    this.tileHeight = [];
    this.tileResource = [];
    this.tileSprites = [];
    this.tileResourceOverlay = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      this.tileType[i] = [];
      this.tileHeight[i] = [];
      this.tileResource[i] = [];
      this.tileSprites[i] = [];
      this.tileResourceOverlay[i] = [];
    }

    // ── Generování výškové mapy ─────────────────────────────────────
    // Worldgen je nezávislý na render orderu — generujeme předem v jedné
    // smyčce přes celou mřížku. (i, j) jsou souřadnice v tile space; pro
    // value-noise je škálujeme přes Z_*_FREQ na "noise space".
    //
    // Druhá oktáva používá XOR seedu — dává nezávislý šum (jiná hash sekvence).
    // Bez toho by oba noise byly identické (lo == hi).
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const lo = signedNoise2D(i * Z_LO_FREQ, j * Z_LO_FREQ, seed);
        const hi = signedNoise2D(i * Z_HI_FREQ, j * Z_HI_FREQ, seed ^ 0xa5a5a5a5);
        const raw = Z_BASE + Z_LO_AMP * lo + Z_HI_AMP * hi;
        // Math.round (ne floor) — floor systematicky srazí mean o 0.5 dolů,
        // což posune distribuci k vodě a vyřadí mountain pásmo.
        // Clamp do [Z_MIN, Z_MAX] — amplitudy mohou přesáhnout 0..15 (max je
        // Z_BASE+Z_LO_AMP+Z_HI_AMP = 16 → clamp 15).
        this.tileHeight[i]![j] = Math.max(Z_MIN, Math.min(Z_MAX, Math.round(raw)));
      }
    }

    // Iterace v pořadí (i+j) ASC — to je correct z-order pro izometrii.
    // Tj. nejprve (0,0), pak (1,0)+(0,1), pak (2,0)+(1,1)+(0,2), atd.
    // Sprity přidávané později leží nad těmi předchozími — boční stěny "vyšších"
    // (i+j) dlaždic překryjí "nižší" jak má být.
    for (let sum = 0; sum < 2 * GRID_SIZE - 1; sum++) {
      for (let i = 0; i < GRID_SIZE; i++) {
        const j = sum - i;
        if (j < 0 || j >= GRID_SIZE) continue;

        const z = this.tileHeight[i]![j]!;
        const typeId = forceTypeId ?? heightToTileType(z, i, j, seed);
        this.tileType[i]![j] = typeId;

        // ── Cliff faces — výškový rozdíl k jižním sousedům ─────────────
        // BR cliff (right side face) → soused (i+1, j) = SE směr.
        // BL cliff (left side face)  → soused (i, j+1) = SW směr.
        // Out-of-bounds soused = same z (no cliff na hraně mapy → "mapa
        // visí v prázdnu, ale interní výškové rozdíly jsou viditelné").
        const zSE = this.tileHeight[i + 1]?.[j] ?? z;
        const zSW = this.tileHeight[i]?.[j + 1] ?? z;
        const cliffRightLevels = Math.max(0, z - zSE);
        const cliffLeftLevels  = Math.max(0, z - zSW);
        const cliffMagnitude   = Math.max(cliffRightLevels, cliffLeftLevels);
        const cliffRight = cliffRightLevels * PIXELS_PER_LEVEL;
        const cliffLeft  = cliffLeftLevels  * PIXELS_PER_LEVEL;

        const obj = useGraphics
          ? createTileGraphic(typeId, cliffRight, cliffLeft)
          : createTileSprite(typeId, textures);
        // Tile s vyšším z je výš na obrazovce (menší y).
        const { x, y } = tileToScreen(i, j, z);
        obj.position.set(x, y);
        this.container.addChild(obj);
        this.tileSprites[i]![j] = obj;

        // ── Resource overlay (Fáze 2.2) ─────────────────────────────
        // Generujeme až teď, kdy známe cliffMagnitude. addChild PO tile
        // (= overlay je v render order nad tile, ale stále pod sousedy
        // s vyšším i+j).
        const resourceTypeId = generateResource(z, cliffMagnitude, i, j, seed);
        this.tileResource[i]![j] = resourceTypeId;
        if (resourceTypeId !== null) {
          const overlay = createResourceOverlay(resourceTypeId);
          overlay.position.set(x, y);
          this.container.addChild(overlay);
          this.tileResourceOverlay[i]![j] = overlay;
        } else {
          this.tileResourceOverlay[i]![j] = null;
        }
      }
    }
  }

  /**
   * Sběr resource z tile (Fáze 2.2.5). Vrátí typeId resource, který byl
   * sebrán, nebo null pokud na tile žádný nebyl. Po úspěšném sběru:
   *   - `tileResource[i][j] = null`
   *   - overlay Graphics je destroyed (uvolní paměť, zmizí z renderu)
   *
   * Volající (input.ts) se postará o aktualizaci inventáře.
   */
  harvest(i: number, j: number): number | null {
    if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) return null;
    const r = this.tileResource[i]?.[j];
    if (r === null || r === undefined) return null;

    const overlay = this.tileResourceOverlay[i]?.[j];
    if (overlay) {
      overlay.destroy();
    }
    this.tileResourceOverlay[i]![j] = null;
    this.tileResource[i]![j] = null;
    return r;
  }

  /** Bezpečný getter — vrátí typeId nebo null pokud je tile mimo mřížku. */
  getTypeAt(i: number, j: number): number | null {
    if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) return null;
    return this.tileType[i]?.[j] ?? null;
  }

  /** Bezpečný getter — vrátí výšku nebo null pokud je tile mimo mřížku. */
  getHeightAt(i: number, j: number): number | null {
    if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) return null;
    return this.tileHeight[i]?.[j] ?? null;
  }

  /** Vrátí jméno typu dlaždice (pro debug HUD). */
  getNameAt(i: number, j: number): string | null {
    const id = this.getTypeAt(i, j);
    if (id === null) return null;
    return TILE_TYPES[id]?.name ?? null;
  }
}

