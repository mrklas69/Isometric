// =============================================================================
// Resource — definice typů sklizitelných zdrojů na mapě.
//
// Aktuálně 3 typy (Fáze 2.2):
//   - tree   : roste na grass / hills (z 7–19) ~25 %
//   - iron   : těží se na mountain (z 20–23) ~40 %
//   - stone  : sbírá se na cliff tiles (rozdíl k sousedovi ≥3 levels) ~25 %
//
// Generování viz `generateResource` v `grid.ts`. Render overlay viz
// `createResourceOverlay` v `tiles.ts`.
// =============================================================================

import { ENDESGA32 } from './palette.js';

export type ResourceTypeDef = {
  readonly id: number;
  readonly name: string;
  readonly color: number;     // primární barva ikonky
  readonly accent: number;    // sekundární barva (kmen / shadow / detail)
};

// id konstanty — používáme jako indexy v `RESOURCE_TYPES`. Drží jméno na jednom
// místě, kdyby se id někdy změnily, najdeme to grepem.
export const RESOURCE_TREE  = 0;
export const RESOURCE_IRON  = 1;
export const RESOURCE_STONE = 2;

export const RESOURCE_TYPES: readonly ResourceTypeDef[] = [
  { id: RESOURCE_TREE,  name: 'tree',  color: 0x265c42, accent: 0x733e39 },  // tmavě zelená koruna, hnědý kmen
  { id: RESOURCE_IRON,  name: 'iron',  color: 0xc0cbdc, accent: 0x5a6988 },  // stříbrný lesk, šedý okraj
  { id: RESOURCE_STONE, name: 'stone', color: 0x8b9bb4, accent: 0x5a6988 },  // šedý kámen, tmavší shadow
] as const;

// Sanity check — kdyby někdo přidal nový typ a zapomněl konstantu.
if (RESOURCE_TYPES.length !== 3) {
  throw new Error(`Očekávány 3 resource typy, je jich ${RESOURCE_TYPES.length}`);
}

// =============================================================================
// Resource depletion (Fáze 5.4)
// =============================================================================
//
// Každý resource tile má počáteční počet jednotek = `RESOURCE_INITIAL_AMOUNT[id]`.
// Mine při produkci (1 unit / 60 tiků = 2 s real-time) sníží počet o 1.
// Když dosáhne 0 → resource sprite zmizí, mine přestane produkovat (Factorio styl).
// Ruční harvest (klik) také snižuje o 1.
//
// Hodnoty:
//   - TREE  =  1  → 1 klik = strom je pryč (instant, jako Fáze 2.2)
//   - IRON  = 100 → mine ho vyčerpá za 100 × 2 s = 200 s při 1× speed
//   - STONE = 200 → 400 s při 1× (běžnější resource, větší zásoba)
//
// Index = RESOURCE_* konstanta. Pole, ne Record — kompaktnější + iso s ostatními
// pole přístupy (`RESOURCE_TYPES[id]`).
// =============================================================================
export const RESOURCE_INITIAL_AMOUNT: readonly number[] = [
  1,    // TREE
  100,  // IRON
  200,  // STONE
] as const;

// Sanity — délka musí odpovídat počtu typů, jinak by byl bug "iron je pryč po 1 ticku".
if (RESOURCE_INITIAL_AMOUNT.length !== RESOURCE_TYPES.length) {
  throw new Error(
    `RESOURCE_INITIAL_AMOUNT má ${RESOURCE_INITIAL_AMOUNT.length} položek, očekáváno ${RESOURCE_TYPES.length}`,
  );
}

// Hold reference k paletě, ať lze později přejít na PAL.* hex literály bez
// rebreakingu importů. (Aktuálně nevyužito — barvy jsou natvrdo.)
void ENDESGA32;
