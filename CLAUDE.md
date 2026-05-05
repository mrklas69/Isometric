# CLAUDE.md — Isometric

> Projektové instrukce pro Claude Code. Globální pravidla viz `~/.claude/CLAUDE.md`.

## Co to je
**Webová izometrická 2D tile-based hra žánru *logistic / factory builder*** — automatizace, výroba, těžba, doprava. Inspirační okruh: Factorio, Mindustry, Settlers, OpenTTD.

## Stack
- **Platforma:** web (browser)
- **Renderer:** **PixiJS** (WebGL 2D sprite renderer)
- **Jazyk:** **TypeScript** (strict mode)
- **Build/dev:** **Vite**
- **Závislosti:** zatím žádné nad rámec výše

> Stack zvolený pro: čisté oddělení rendereru od game logiky (PixiJS není opinionated framework), GPU-akcelerovaný sprite rendering pro stovky+ dlaždic, TS pro typovou bezpečnost a autocomplete při učení.

## MVP (cíl prvního milníku)
1. Render izometrického gridu **10×10**
2. Každá dlaždice náhodně z **10 druhů** (s deterministickým seedem, aby se grid při re-renderu nepřeskupoval)
3. **Ovládání kamery** (posun, zoom — detail TBD)
4. **Běžící časomíra** v HUD
5. **Highlight dlaždice pod kurzorem**

## Struktura
```
Isometric/
├── .source/                       # historické referenční obrázky (atlas v1 archiv)
├── public/                        # Vite servíruje jako webroot (URL: /)
├── scripts/                       # historické asset processing skripty (atlas pipeline, parkováno)
├── docs/
│   └── asset-brief.md             # historický brief (atlas v1, parkováno)
├── src/
│   ├── main.ts                    # entry — kompozice modulů, vybudování cache
│   ├── palette.ts                 # Endesga 32 + TILE_TYPES (8 typů)
│   ├── iso.ts                     # tile↔screen math (2:1 dimetric, PIXELS_PER_LEVEL)
│   ├── iso3d.ts                   # 3D→iso projekce + 3-tonal shading (lerp k bílé/černé)
│   ├── primitives.ts              # diamond / shadow / cylinder / cone / sphere / blob
│   ├── recipes.ts                 # resource recipes (tree 5 var, stone, iron)
│   ├── tile-recipes.ts            # tile recipes (8 typů × 3 varianty)
│   ├── render-cache.ts            # pre-render Recipe[][] → CachedSprite[][]
│   ├── tiles.ts                   # createTileSprite/CliffGraphic/ResourceSprite + highlight/selection
│   ├── grid.ts                    # GRID_SIZE × GRID_SIZE data + render gridu
│   ├── camera.ts                  # pan + zoom + damping
│   ├── input.ts                   # myš, klávesnice, picking s výškou
│   ├── hud.ts                     # časomíra, hover info, inventář
│   ├── inventory.ts               # nasbíraných resource (sdílený mutable state)
│   ├── resource.ts                # RESOURCE_TYPES + id konstanty
│   └── noise.ts                   # value-noise (heightmap) + hash2 (variants)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── CLAUDE.md
├── TODO.md
└── IDEAS.md
```

**Vite konvence**: static herní assety patří do `public/` (servírují se přímo přes URL bez import / hash), zdrojové soubory v `src/`.

## Render architektura (Fáze 3)
Vše vykreslené je **sprite z RenderTexture cache**, vyrenderovaný z **recipe = pole 3D primitiv** v 2:1 dimetric projekci.

- **Primitiva** v `primitives.ts`: `diamond` (top tile face), `shadow` (drop shadow elipsa), `cylinder`, `cone`, `sphere`, `blob`. Každá kreslí 1–3 polygons s 3-tonal flat shadingem (top/left/right face, slunce z left-up screen, lerp k bílé/černé).
- **Recipe** v `recipes.ts` (resources) a `tile-recipes.ts` (tiles): pole primitiv, max 5 per recipe. Origin (0,0,0) = ground střed tile.
- **Cache** v `render-cache.ts`: `buildTileCache(renderer, Recipe[][])` → `CachedSprite[][]` (texture + anchor v lokál (0,0,0)). Pre-render při bootu, lookup O(1).
- **Variants** per typ: deterministicky `hash(i, j, seed) % N` — stejná tile vždy stejný look, ale bez vzoru.
- **Cliff faces** zůstávají procedurální v `grid.ts` (decoupling — kombinatorická exploze cache by byla 4608+ textur). Per tile dle z-rozdílu sousedů.

Inspirace: `C:\Users\mrkla\source\TheCubes` (Three.js voxel sandbox), pattern: **kompozice low-poly primitiv + flat shading**.

## Open Questions
- **Q-diary:** DIARY.md / DONE.md / GLOSSARY.md ve stylu Stickman, nebo dál KISS?
- **Q-stone-iron-variants:** Vyrobit také varianty stone a iron (dnes 1 každý)?

## Workflow
Default podle globálního `~/.claude/CLAUDE.md`.

## Makra

### `@BEGIN` — začátek sezení
Doplňuje globální `@BEGIN` o krok (5.) Server:
- Spusť dev server na pozadí: `npm run dev` (Vite, default `http://localhost:5173/`).
- URL sděl uživateli.
- Pokud už server běží (port obsazený), nespouštěj druhý — jen oznam, že běží.

### `@END` — konec sezení
1. Úklid (debug výpisy, mrtvý kód, dočasné soubory).
2. Dokumentace — aktualizuj `TODO.md` (Done sekce), případně další `*.md` dotčené sezením. (DIARY.md zatím KISS odložen.)
3. `git add` jen relevantní soubory (NE `package-lock.json` po `npm install`, pokud se změnil jen vedlejším efektem).
4. Commit s popisem sezení + push.
5. Stop dev serveru, pokud běží.
