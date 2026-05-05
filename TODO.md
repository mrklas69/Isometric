# TODO

## Now

(prázdné — Fáze 2 dokončena, čeká rozhodnutí o další fázi)

## Next — Fáze 3 kandidáti
- **Movement** — postavy/budovy na gridu, click-to-move s pathfindingem nad heightmap.
- **Stavba budov** — placement rule (z, terrain type, no cliff edges), production logic.
- **Tick simulace** — fixed tickrate (30 tps), recipe / fronty / dopravníky core.
- **Nepřekonatelnost** — `IMPASSABLE_THRESHOLD` rule pro útesy (gameplay constraint).

## Parking (až bude chuť)
- [ ] **Namalovat vlastní dlaždice** — 8 typů, šablona 128 px wide, diamond top half_h = 32 (= 2:1), bočnice depth ~32 px, transparent pozadí. Naming `{type}01.png` v `public/assets/terrain/`. Po dodání: `USE_GRAPHICS = false` v `main.ts:67`.
- [ ] **Q-diary** — DIARY.md / DONE.md / GLOSSARY.md ve stylu Stickman, nebo dál KISS?

## Later
- [ ] **Resource regenerace** — strom doroste za N sekund (vyžaduje game-clock / tick simulaci). Odložené z Fáze 2.
- [ ] Variant pool (více variant per typ, deterministic random per (i, j))
- [ ] Další žánrové prvky (těžba budovou, výroba, dopravníky, …)
- [ ] Auto-tiling (Wang / blob tiles) pro hraniční přechody

## Done
- [x] **Fáze 2.2 — Resource layer & sběr** (commit `45b0d5d`)
  - `src/resource.ts` + `src/inventory.ts` (nové moduly)
  - 3 typy resource (tree / iron / stone) s pravidly: iron 40 % na mountain z≥20, stone 25 % na cliffs Δz≥3, tree 25 % na grass/hills z 7–19
  - Procedurální Graphics overlay (smrček, ruda, kámen) — bez sprites
  - Selektor (oranžový persistent outline, vs. žlutý hover); levý klik = sběr nebo select; Esc = deselect
  - HUD inventář: `tree N | iron N | stone N`
  - `Grid.harvest(i, j)` metoda + sdílený `Inventory` mezi `input` a `hud`
- [x] **Fáze 2.1 — Mapa žije: výškový model** (commit `be1a08b`)
  - 2-oktávový value-noise generátor (`src/noise.ts`)
  - Tile.z ∈ [0, 23] s pásmovou type mapping
  - Cliff faces dle výšky sousedů (BR + BL)
  - Render screen Y offset z výšky
  - Pickování s výškou (Z_MAX → Z_MIN)
  - HUD ukazuje `z=N` v hover info
- [x] **Větší mapa 100×100** — `GRID_SIZE` v `grid.ts`, 10k dlaždic, FPS OK
- [x] **Procedurální Graphics dlaždice** — `createTileGraphic` v `tiles.ts`, render bez závislosti na PNG
- [x] **Diagnostika sprite drift** — atlas v1 (Gemini) má per-typ nekonzistentní diamond shape → sprite path zaparkován
- [x] **Pipeline `scripts/process_atlas.py`** — připravená pro v2 atlas (CC cleanup, magenta→alpha, Y-squash, padding na 128×128)
- [x] **Procedurální RenderTexture path** (`procedural.ts`) — fallback pro test/development
- [x] Sprite-based render integrace (sprite path je k dispozici, USE_GRAPHICS toggle v `main.ts`)
- [x] TILE_TYPES sjednoceno na 8 (`palette.ts`)
- [x] 8 PNG dlaždic v `public/assets/terrain/` (zaparkované do v2)
- [x] Asset brief pro 3rd-party generátor (`docs/asset-brief.md`)
- [x] Stack: Vite + TypeScript + PixiJS v8
- [x] Iso math, Mulberry32 grid, kamera s damping, klávesnice + drag pan + wheel zoom, hover highlight, časomíra
