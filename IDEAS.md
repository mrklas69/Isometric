# IDEAS

> Raw nápady, hypotézy, "co kdyby". Nic není závazek. Když nápad dozraje na úkol → přesun do `TODO.md`.

## Vizuální reference
Dva referenční obrázky v `.source/` (jen inspirace, ne assety):
- `a_isometric_tile_grid_.png` — pixel-art / low-poly krajina; viditelná **highlighted tile pod kurzorem** → naznačuje interakci
- `b_isometric_tile_grid_.jpeg` — vyšší detail, čtvercový ostrov

Společný jazyk: **diamond-shape tiles, 2:1 poměr** (klasický izometrický grid), výškové úrovně, varianty terénu, entity nad mřížkou.

## Asset convention
Adresář `assets/` bude obsahovat číslované varianty: `grass01..NN`, `sand01..NN`, `stone01..NN`, `forest01..NN`, `sea01..NN`, `bay01..NN`, `river01..NN`, …

Implikace:
- **Variant pool**: random-pick variant při placementu — proti sterilní mřížce
- **Deterministická náhoda**: `pick = hash(tileX, tileY) % poolSize` — stejná tile vždy stejnou variantu, žádné blikání při re-renderu
- **Hraniční dlaždice** (přechody tráva→písek): zvážit auto-tiling (Wang / blob tiles) později; v MVP bez přechodů

## Výškový model (Fáze 2.1) — schválený koncept

**Terasovitý height** (integer Z, žádné warped tiles). Každý tile má `z ∈ {0, …, 15}`. Mezi tiles s rozdílným z se renderuje **cliff face** (svislá stěna). Tile sám zůstává plochý kosočtverec.

### Generátor
```
z(i, j) = floor( clamp( base + perlin_lo(i,j) * Alo + perlin_hi(i,j) * Ahi , 0, 15) )
```
- `base = 7` (uprostřed grass pásma → flat svět má všude grass)
- `perlin_lo`: low-freq value-noise (~0.05) — velké kontinenty / pohoří
- `perlin_hi`: high-freq value-noise (~0.2) — drobné nerovnosti
- Amplitudy laděné tak, aby svět dával ~50 % grass, ~15 % water, ~15 % hills, ~10 % mountain, ~10 % sand/přechody.
- Bez external dep — vlastní `noise.ts` (~30 řádků: hashed value-noise + bilinear interpolace).

### Height → terrain type pásma
| Z | Type | Poznámka |
|---|---|---|
| 0–3 | `water` | (z=0–1 hluboká, z=2–3 mělká — zatím nerozlišujeme) |
| 4 | `sand` | jednořadové pobřeží |
| 5–9 | `grass` | hlavní pásmo + variace `forest`, `farmland`, `wetlands` (jemný noise) |
| 10–13 | `hills` | + variace `dirt`, `forest` |
| 14–15 | `mountain` | + sníh na 15? Zatím ne |

### Pixel mapping
- `PIXELS_PER_LEVEL = 8` — vertikální offset per úroveň výšky.
- `screenY = (i + j) * TILE_HALF_H - z * PIXELS_PER_LEVEL`.
- Maximum vertikální rozdíl: 15 × 8 = 120 px ≈ 2× tile width.

### Cliff render
Když `tile(i,j).z > tile(i+1, j).z` nebo `tile(i,j).z > tile(i, j+1).z`, mezi nimi se renderuje obdélník výšky `(z - z_neighbor) * PIXELS_PER_LEVEL` v tmavé stone barvě. Pro oba viditelné směry v izo (right + bottom-right). Levý a top-left soused je za námi (nevidíme z těch stran).

### Pickování s výškou
Kurzor je v screen-space. Kvůli výšce může jeden screen pixel pokrývat víc tiles (vyšší tile vlevo zakrývá nižší tile vpravo). Algoritmus:
1. Pro daný `(mouseX, mouseY)` zpětně dopočítej kandidáty (i, j) — ti, kteří by mohli být pod kurzorem v nějaké výšce.
2. Z kandidátů vyber **toho s nejvyšším z**, jehož diamond (po offsetu o `-z*8`) skutečně pokrývá kurzor.
3. To je hovered tile.

### Render order
- Primárně: `(i + j)` ASC — back-to-front izometrie.
- Sekundárně: pro stejné `(i+j)` sort `z` DESC — vyšší se renderuje dřív (níže ve frontě), nižší později nahoře. **Pozor na tohle**: ve faktu chceme back-to-front, takže nižší z za vyšším z = vyšší se kreslí později. Otestovat empiricky.

### Otevřené detaily
- Spojení sousedních cliff faces v rohu (tj. když 2 sousedi jsou níž) — kreslit dva separátní obdélníky nebo jednu sjednocenou plochu? Default: 2 separátní. Pokud bude visual artifact, řešit.
- Co s tile typu `water` na cliff face? Voda je z ≤ 3, takže cliff faces nad vodou (z 4+ na vodu) jsou normální. OK.
- Sníh / variace v rámci pásma: použít `hash(i,j) % 100 < threshold` — odložit na později, nepatří do MVP 2.1.

---

## Žánrové implikace (logistic / factory builder)
Inspirační okruh: Factorio, Mindustry, Settlers, OpenTTD. Důsledky pro budoucí architekturu (mimo MVP):

- **Tick-based simulace**: pevný tickrate (např. 30 nebo 60 tps), oddělený od FPS rendereru
- **Entity layer** nad gridem: budovy, dopravníky, postavičky, itemy v pohybu
- **Recepty + fronty**: producer → buffer → conveyor → consumer; nutná datová reprezentace toků
- **Pathfinding** (postavy) nebo **grid-flow** (belt sim) — různé režimy podle žánrového směru
- **Fog of war / průzkum**: u Settlers ano, u Factorio ne — k rozhodnutí
- **Ekonomika a UI**: production stats, sklady, alerts

> **Pro MVP nic z toho neřešíme.** MVP je čistý renderer + kamera + časomíra + hover. Žánrové prvky postupně.

## Render architektura (Fáze 3)

PNG path zrušena. Veškerý rendering jde přes **recipe systém** — pole 3D primitiv pre-renderované do RenderTexture, sprite per tile referuje cached texturu. Detail v `CLAUDE.md` sekce "Render architektura".

## Technical pole k prozkoumání
- **Render strategie:** sprite-based (PNG dlaždice) — odpovídá asset convention
- **Souřadnicový systém:** tile (i, j) ↔ screen (x, y) — standardní `screenX = (i - j) * TILE_W/2`, `screenY = (i + j) * TILE_H/2`
- **Pickování tile pod kurzorem** (inverzní transformace screen→tile)
- **Z-ordering** entit přes víc dlaždic — render po sloupcích zezadu dopředu (tile order j+i ascending), nebo Y-sort dynamických objektů
- **Kamera:** posun (drag, edge-scroll, klávesnice), zoom, hranice mapy
- **Časomíra a tickrate:** v MVP jen real-time clock; později herní tiky oddělené od rendereru
