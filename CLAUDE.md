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
├── .source/                       # referenční obrázky + zdrojové atlasy
│   └── terrain_atlas_v1.png       # Gemini-generated 4×2 atlas → input pipeline
├── public/                        # Vite servíruje jako webroot (URL: /)
│   └── assets/
│       └── terrain/               # PNG dlaždice (128×119–127 px, RGBA)
│           ├── grass01.png
│           ├── dirt01.png
│           └── ...                # 8 typů celkem
├── scripts/
│   ├── process_atlas.py           # atlas → individual tiles pipeline
│   │                              #   (CC labeling, magenta→alpha, resize)
│   └── debug_sparkle.py           # debug helper (lokalizace artefaktů)
├── docs/
│   └── asset-brief.md             # brief pro 3rd-party asset generators
├── src/
│   ├── main.ts                    # entry — kompozice modulů
│   ├── palette.ts                 # Endesga 32 + TILE_TYPES (8 typů)
│   ├── iso.ts                     # tile↔screen souřadnicová math
│   ├── tiles.ts                   # createTileSprite + createHighlightGraphic
│   ├── assets.ts                  # async loader textur (PixiJS Assets API)
│   ├── grid.ts                    # 10×10 data + render gridu
│   ├── camera.ts                  # pan + zoom + damping
│   ├── input.ts                   # myš, klávesnice, picking
│   └── hud.ts                     # časomíra, hover info
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── CLAUDE.md
├── TODO.md
└── IDEAS.md
```

**Vite konvence**: static herní assety patří do `public/` (servírují se přímo přes URL bez import / hash), zdrojové soubory v `src/`. Naše PNG textury jsou runtime-loaded → `public/assets/terrain/`.

## Asset convention
PNG dlaždice v `public/assets/terrain/`:
- Naming: `{type}{NN}.png` — `grass01.png`, `forest01.png`, …
- Aktuálně **8 typů × 1 varianta** (MVP). Variant pool přijde později — engine bude
  random-pickovat deterministicky podle pozice (`hash(i, j) % poolSize`).
- Pipeline: zdrojový atlas (4×2 grid na #ff00ff pozadí, např. od Gemini) →
  `scripts/process_atlas.py` → individuální PNG s alpha kanálem.

## Open Questions
- **Q-diary:** DIARY.md / DONE.md / GLOSSARY.md ve stylu Stickman, nebo dál KISS?
- **Q-more-tiles:** Doplnit chybějící terény (`sand`, `stone`, `snow`) v dalším atlas batchi?

## Aktuální stav rendereru
`USE_GRAPHICS = true` v `main.ts` — procedurální PIXI.Graphics dlaždice (8 barev z palety). Atlas v1 (Gemini) má per-typ nekonzistentní iso shape → sprite path driftoval. Plán: **vlastní manuální malba** 8 dlaždic se šablonou odpovídající iso math (128 wide, half_h=32). Po dodání assetů `USE_GRAPHICS = false` aktivuje sprite path.

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
