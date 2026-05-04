// =============================================================================
// Paleta projektu — Endesga 32 (CC0, https://lospec.com/palette-list/endesga-32)
//
// 32 hex hodnot, exportovaných jako pole `ENDESGA32` a pojmenovaný objekt `PAL`.
// Všechny barvy v projektu BERTE odsud — žádné rozseté hex literály po kódu
// (DRY princip: jediný zdroj pravdy).
// =============================================================================

// `as const` — TypeScript zachová přesné literály typu (number) místo widening
// na obecné `number[]`. Důležité pokud bychom chtěli odvozený union typ.
export const ENDESGA32 = [
  0xbe4a2f, 0xd77643, 0xead4aa, 0xe4a672, 0xb86f50, 0x733e39, 0x3e2731, 0xa22633,
  0xe43b44, 0xf77622, 0xfeae34, 0xfee761, 0x63c74d, 0x3e8948, 0x265c42, 0x193c3e,
  0x124e89, 0x0099db, 0x2ce8f5, 0xffffff, 0xc0cbdc, 0x8b9bb4, 0x5a6988, 0x3a4466,
  0x262b44, 0x181425, 0xff0044, 0x68386c, 0xb55088, 0xf6757a, 0xe8b796, 0xc28569,
] as const;

// Pojmenované odkazy na nejčastěji používané barvy. Pomáhá čitelnosti
// (PAL.bg vs ENDESGA32[25]).
export const PAL = {
  bg:        0x181425,   // hluboká tmavá — pozadí canvasu
  panel:     0x262b44,   // panely / HUD pozadí
  panelLine: 0x3a4466,   // okraje panelů
  text:      0xc0cbdc,   // primární text (mírně modrý šedák)
  hover:     0xfee761,   // žluté zvýraznění (highlight pod kurzorem)
  selection: 0xf77622,   // oranžová pro výběr (později)
} as const;

// =============================================================================
// Typy dlaždic — definitivní seznam (sjednocený s reálnými PNG assety
// v `public/assets/terrain/{name}01.png`).
//
// `top` = orientační dominantní barva — používá se jen pro debug / fallback.
// Skutečný render používá sprite z PNG textury (viz `src/tiles.ts`).
// =============================================================================

export type TileTypeDef = {
  readonly id: number;       // index v poli (= "barva ze seedu" → typ)
  readonly name: string;     // jméno + asset filename ({name}01.png)
  readonly top: number;      // orientační dominantní hex (debug / mini-mapa)
};

// Pořadí ID je stabilní — nikdy nepřeházet, jinak se mapa pod stejným seedem
// zamíchá. Přidávat můžeš VŽDY jen na konec.
export const TILE_TYPES: readonly TileTypeDef[] = [
  { id: 0, name: 'grass',    top: 0x3e8948 },   // sytá zelená louka
  { id: 1, name: 'dirt',     top: 0xb86f50 },   // hnědá hlína
  { id: 2, name: 'water',    top: 0x0099db },   // modrá voda
  { id: 3, name: 'farmland', top: 0x733e39 },   // zorané pole
  { id: 4, name: 'forest',   top: 0x265c42 },   // tmavě zelený les
  { id: 5, name: 'mountain', top: 0x5a6988 },   // šedá hora
  { id: 6, name: 'hills',    top: 0x63c74d },   // světle zelený kopec
  { id: 7, name: 'wetlands', top: 0x3e8948 },   // mokřady (zelené s rákosem)
] as const;

// Sanity check — drží počet typů konzistentní s počtem assetů.
if (TILE_TYPES.length !== 8) {
  throw new Error(`Očekáváno 8 typů dlaždic, je jich ${TILE_TYPES.length}`);
}
