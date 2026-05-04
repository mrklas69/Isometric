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

## Žánrové implikace (logistic / factory builder)
Inspirační okruh: Factorio, Mindustry, Settlers, OpenTTD. Důsledky pro budoucí architekturu (mimo MVP):

- **Tick-based simulace**: pevný tickrate (např. 30 nebo 60 tps), oddělený od FPS rendereru
- **Entity layer** nad gridem: budovy, dopravníky, postavičky, itemy v pohybu
- **Recepty + fronty**: producer → buffer → conveyor → consumer; nutná datová reprezentace toků
- **Pathfinding** (postavy) nebo **grid-flow** (belt sim) — různé režimy podle žánrového směru
- **Fog of war / průzkum**: u Settlers ano, u Factorio ne — k rozhodnutí
- **Ekonomika a UI**: production stats, sklady, alerts

> **Pro MVP nic z toho neřešíme.** MVP je čistý renderer + kamera + časomíra + hover. Žánrové prvky postupně.

## Známý issue: PNG sprite drift (atlas v1)

Gemini-vyrobený atlas `terrain_atlas_v1.png` má **per-typ nekonzistentní tvar diamondu** — např. forest má diamond top vyšší / širší než water. Měřená levá špička (col-x=0) je 32-45 px per typ; diamond bottom corner v centrálním sloupci je v různé y per typ.

Důsledek: sprite render path (sprite + anchor + texture quad) drifty cca 5 px per tile na sousedech různých typů → kumulativní schody v rohu mřížky. **Procedurální Graphics path** funguje (stejný iso math, ale unifikovaný shape).

Cesty k fixu (zvažované):
- **Regenerace atlasu** s explicit "2:1 dimetric, diamond half_h = half_w / 2 exact pixel-aligned" (= viz `docs/asset-brief.md`)
- **Per-typ X+Y squash** v pipeline — měřit diamond bounding box v PNG (treetop overflow detection nontrivial)
- ✅ **Manuální vlastní malba** dlaždic (rozhodnuto) — uživatel namaluje tilesety vlastnoručně, šablona odpovídá iso math (128×64 diamond + bočnice, top corner v PNG y=0)
- **Vlastní render Graphics → high-res RenderTexture s textured fill** (= cartoon look, jednotný shape)

Aktuálně: `USE_GRAPHICS = true` v `main.ts` (= procedurální placeholder dlaždice). Sprite path je connected (PNG load → PIXI.Sprite + anchor), připravená, čeká na vlastní malované assety s konzistentním shape.

## Technical pole k prozkoumání
- **Render strategie:** sprite-based (PNG dlaždice) — odpovídá asset convention
- **Souřadnicový systém:** tile (i, j) ↔ screen (x, y) — standardní `screenX = (i - j) * TILE_W/2`, `screenY = (i + j) * TILE_H/2`
- **Pickování tile pod kurzorem** (inverzní transformace screen→tile)
- **Z-ordering** entit přes víc dlaždic — render po sloupcích zezadu dopředu (tile order j+i ascending), nebo Y-sort dynamických objektů
- **Kamera:** posun (drag, edge-scroll, klávesnice), zoom, hranice mapy
- **Časomíra a tickrate:** v MVP jen real-time clock; později herní tiky oddělené od rendereru
