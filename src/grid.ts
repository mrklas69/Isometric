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

import { Container } from 'pixi.js';
import type { Sprite, Graphics } from 'pixi.js';
import { TILE_TYPES } from './palette.js';
import { RESOURCE_TREE, RESOURCE_IRON, RESOURCE_STONE } from './resource.js';
import { tileToScreen, PIXELS_PER_LEVEL, HALF_H } from './iso.js';
import { createTileSprite, createCliffGraphic, createResourceSprite, createBuildingSprite } from './tiles.js';
import type { CachedSprite } from './render-cache.js';
import { TILE_VARIANTS_PER_TYPE } from './tile-recipes.js';
import { signedNoise2D, hash2 } from './noise.js';
import type { Buildings } from './buildings.js';
import type { Building } from './building.js';

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
const VARIATION_SEED_XOR        = 0x5a5a5a5a;   // tile typ variation (forest/farmland uvnitř grass pásma)
const RESOURCE_SEED_XOR         = 0x3c3c3c3c;   // resource generování
const VARIANT_SEED_XOR          = 0x9c9c9c9c;   // tile variant (3 varianty per typ)
const RESOURCE_VARIANT_SEED_XOR = 0xb6b6b6b6;   // resource variant (5 variant tree, 1 stone/iron)

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
// Mapping (z, cliffMagnitude, i, j) → resource type | null
//
// Pravidla:
//   - mountain (z ≥ 20):           5 % iron + 25 % stone (zbytek prázdný)
//   - cliff tile (Δz ≥ 2, z ≥ 7):  30 % stone
//   - grass/hills (z 7–19):        25 % tree
//
// Iron je vzácná (5 % vrcholů), stone je dominantní horský resource. Cliff
// threshold snížen z 3→2 levels (= víc svahů dostane kameny). Cliff má prioritu
// nad tree → na strmém svahu hilly tile dostaneš `stone`, ne `tree`.
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
    // Mountain — iron je vzácná (5 %), zbytek je stone do 30 % cumulative.
    if (v < 0.05) return RESOURCE_IRON;
    if (v < 0.30) return RESOURCE_STONE;
    return null;
  }
  if (cliffMagnitude >= 2 && z >= 7) {
    // Cliff tile (= strmý svah) → kámen. Z ≥ 7 vyloučí cliffs ve vodě.
    return v < 0.30 ? RESOURCE_STONE : null;
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

  /** Lookup tile sprite per (i, j) — top diamond + decorations z cache. */
  private readonly tileSprites: Sprite[][];

  /**
   * Lookup cliff Graphics per (i, j) — null pokud rovinní sousedi (žádné cliff).
   * Cliff je samostatná Graphics layer, dynamic per tile dle z-rozdílů sousedů.
   */
  private readonly tileCliffs: (Graphics | null)[][];

  /**
   * Lookup overlay Sprite per tile (resource ikona z pre-renderované cache).
   * Null pokud tile nemá resource. Při sběru `destroy({ texture: false })`
   * (texturu drží cache, je sdílená přes všechny tile stejného typu).
   */
  private readonly tileResourceOverlay: (Sprite | null)[][];

  /**
   * Lookup buildingId per tile — `tileBuilding[i][j]` = id v Buildings registru,
   * nebo null pokud tile nemá budovu. Slouží jako spatial index pro
   * canPlaceBuilding (kdo stojí na (i, j) → O(1) bez iterace přes všechny budovy).
   */
  private readonly tileBuilding: (number | null)[][];

  /** Lookup Sprite per tile pro building (= viz tileResourceOverlay analogie). */
  private readonly tileBuildingSprite: (Sprite | null)[][];

  /** Centrální building registr — primary store dat budov. */
  private readonly buildings: Buildings;

  /** Pre-rendered building textures — cache[typeId][variantIndex]. */
  private readonly buildingCache: ReadonlyArray<ReadonlyArray<CachedSprite>>;

  /**
   * @param seed            deterministický seed pro náhodné rozhožení tile typů
   * @param tileCache       pre-rendered tile sprites (z buildTileCache).
   *                          Index = `[typeId][variantIndex]`.
   * @param resourceCache   pre-rendered resource sprites.
   *                          Index = RESOURCE_* konstanta (RESOURCE_TREE/IRON/STONE).
   * @param buildingCache   pre-rendered building sprites.
   *                          Index = BUILDING_* konstanta (BUILDING_MINE).
   * @param buildings       centrální building registr (sdílená instance z main.ts)
   * @param forceTypeId     pokud zadáno, VŠECHNY dlaždice budou tohoto typu (debug).
   */
  constructor(
    seed: number,
    tileCache: ReadonlyArray<ReadonlyArray<CachedSprite>>,
    resourceCache: ReadonlyArray<ReadonlyArray<CachedSprite>>,
    buildingCache: ReadonlyArray<ReadonlyArray<CachedSprite>>,
    buildings: Buildings,
    forceTypeId?: number,
  ) {
    this.buildings = buildings;
    this.buildingCache = buildingCache;

    this.container = new Container();
    // sortableChildren = true — children se třídí podle zIndex před každým render.
    // Důvod: budovy se přidávají DYNAMICKY po inicializaci gridu (= placeBuilding
    // při klik), takže prosté pořadí addChild by je dalo nahoru nad sousední tile
    // s vyšším (i+j). Z-order musí respektovat (i+j) ASC bez ohledu na čas
    // přidání. Nastavíme zIndex = i+j na všechny children (sprite, cliff,
    // overlay, building) — Pixi je seřadí.
    //
    // Trade-off: Pixi sortuje children před každým render — pro 10k+ children
    // měřitelná zátěž. Pokud se ukáže jako bottleneck, refaktor na per-row
    // containers (= jeden container per (i+j) bucket, sortableChildren=false).
    this.container.sortableChildren = true;

    // Inicializace 2D polí.
    this.tileType = [];
    this.tileHeight = [];
    this.tileResource = [];
    this.tileSprites = [];
    this.tileCliffs = [];
    this.tileResourceOverlay = [];
    this.tileBuilding = [];
    this.tileBuildingSprite = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      this.tileType[i] = [];
      this.tileHeight[i] = [];
      this.tileResource[i] = [];
      this.tileSprites[i] = [];
      this.tileCliffs[i] = [];
      this.tileResourceOverlay[i] = [];
      this.tileBuilding[i] = [];
      this.tileBuildingSprite[i] = [];
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

        // Variant výběr — deterministicky per (i, j) přes hash, modulo počet
        // variant per typ. Stejná tile vždy stejný vzhled, ale bez vzoru.
        const variantIndex = Math.floor(
          hash2(i, j, seed ^ VARIANT_SEED_XOR) * TILE_VARIANTS_PER_TYPE,
        );
        const sprite = createTileSprite(typeId, variantIndex, tileCache);
        // Tile s vyšším z je výš na obrazovce (menší y).
        const { x, y } = tileToScreen(i, j, z);
        // Sprite anchor je v lokál (0, 0, 0) recipe = STŘED tile. Posun o
        // +HALF_H umístí střed na (x, y + HALF_H), tj. střed top diamondu.
        sprite.position.set(x, y + HALF_H);
        // zIndex = sum (= i+j) → sortableChildren třídí back-to-front.
        sprite.zIndex = sum;
        this.container.addChild(sprite);
        this.tileSprites[i]![j] = sprite;

        // Cliff faces — separátní Graphics layer (dynamic per tile dle
        // z-rozdílu sousedů). Null pokud rovinní sousedi.
        const cliff = createCliffGraphic(typeId, cliffRight, cliffLeft);
        if (cliff) {
          // Cliff lokál (0, 0) = top corner tile, takže pozice (x, y) přímo
          // (= bez +HALF_H offsetu, který je jen pro sprite-anchor convention).
          cliff.position.set(x, y);
          cliff.zIndex = sum;
          this.container.addChild(cliff);
        }
        this.tileCliffs[i]![j] = cliff;

        // ── Resource overlay (Fáze 2.2) ─────────────────────────────
        // Generujeme až teď, kdy známe cliffMagnitude. addChild PO tile
        // (= overlay je v render order nad tile, ale stále pod sousedy
        // s vyšším i+j).
        const resourceTypeId = generateResource(z, cliffMagnitude, i, j, seed);
        this.tileResource[i]![j] = resourceTypeId;
        if (resourceTypeId !== null) {
          // Variant výběr — deterministicky per (i, j) přes hash, modulo počet
          // variant pro daný resource typ. Stone/iron mají 1 variantu, tree 5.
          const variantsCount = resourceCache[resourceTypeId]?.length ?? 1;
          const resourceVariant = Math.floor(
            hash2(i, j, seed ^ RESOURCE_VARIANT_SEED_XOR) * variantsCount,
          );
          // Sprite z pre-renderované cache. Pozice (x, y + HALF_H) = lokální
          // (0, 0, 0) recipe (= ground střed) přistane na střed top diamond
          // tile. `tileToScreen` vrací top corner; HALF_H je posun na střed.
          const overlay = createResourceSprite(resourceTypeId, resourceVariant, resourceCache);
          overlay.position.set(x, y + HALF_H);
          overlay.zIndex = sum;
          this.container.addChild(overlay);
          this.tileResourceOverlay[i]![j] = overlay;
        } else {
          this.tileResourceOverlay[i]![j] = null;
        }

        // Buildings — žádná na startu (přidávají se přes placeBuilding).
        this.tileBuilding[i]![j] = null;
        this.tileBuildingSprite[i]![j] = null;
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
      // texture: false — texturu drží render cache, sdílená přes tile stejného
      // typu. Destroy by ji odstranil pro VŠECHNY ostatní stromy/kameny/rudy.
      overlay.destroy({ texture: false });
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

  // =============================================================================
  // Building API (Fáze 5.1)
  // =============================================================================

  /** Bezpečný getter — vrátí typeId resource na (i, j), nebo null. */
  getResourceAt(i: number, j: number): number | null {
    if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) return null;
    return this.tileResource[i]?.[j] ?? null;
  }

  /** Bezpečný getter — vrátí buildingId na (i, j), nebo null pokud žádná není. */
  getBuildingAt(i: number, j: number): number | null {
    if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) return null;
    return this.tileBuilding[i]?.[j] ?? null;
  }

  /**
   * Umístí novou budovu daného typu na tile (i, j).
   *
   * **Validace zde NEBÉŘE — caller musí předem zavolat `canPlaceBuilding(...)`.**
   * Pokud se přesto pokusí umístit na obsazený / OOB tile, vrátí null.
   *
   * Co se stane:
   *   1. Buildings registrace → nové id
   *   2. Sprite z buildingCache → addChild do container (zIndex = i+j)
   *   3. tileBuilding[i][j] = id, tileBuildingSprite[i][j] = sprite
   *
   * Resource na tile zůstává (mine ho bude později těžit, ne ničit).
   */
  placeBuilding(typeId: number, i: number, j: number): Building | null {
    if (i < 0 || i >= GRID_SIZE || j < 0 || j >= GRID_SIZE) return null;
    if (this.tileBuilding[i]![j] !== null) return null;

    // 1. Register v centrálním store.
    const b = this.buildings.register(i, j, typeId);

    // 2. Sprite z cache. Pro MVP každá budova má 1 variantu.
    const sprite = createBuildingSprite(typeId, 0, this.buildingCache);
    const z = this.tileHeight[i]![j]!;
    const { x, y } = tileToScreen(i, j, z);
    // Stejné pozicování jako resource overlay — anchor v lokál (0,0,0) =
    // ground střed → +HALF_H umístí střed top diamondu.
    sprite.position.set(x, y + HALF_H);
    sprite.zIndex = i + j;
    this.container.addChild(sprite);

    // 3. Spatial index update.
    this.tileBuilding[i]![j] = b.id;
    this.tileBuildingSprite[i]![j] = sprite;

    return b;
  }

  /**
   * Odstraní budovu po id. Vrátí true pokud existovala.
   *
   * Pro MVP zatím nikdo nevolá (demolice není v 5.1). Implementováno preventivně,
   * abychom symetricky kryli place + remove a měli to ready pro 5.4 demolice.
   */
  removeBuilding(id: number): boolean {
    const b = this.buildings.get(id);
    if (!b) return false;

    const sprite = this.tileBuildingSprite[b.i]?.[b.j];
    if (sprite) {
      // texture: false — sdílená textura z cache (jako u resource).
      sprite.destroy({ texture: false });
    }
    this.tileBuildingSprite[b.i]![b.j] = null;
    this.tileBuilding[b.i]![b.j] = null;

    return this.buildings.unregister(id);
  }
}

