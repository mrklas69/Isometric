# TODO

## Now — Fáze 2.2: Resource layer & sběr

Pásma po kalibraci (Z_MAX = 23):
- water 0–5, wetlands 6, grass 7–13, hills 14–19, mountain 20–23.

- [ ] **Datový model resource** — `Tile.resource: number | null`, typy: `tree`, `iron`, `stone`. Nový `src/resource.ts`.
- [ ] **Generování resource** — deterministic dle (i,j) hash + height/cliff rules:
  - `iron` na mountain (z 20–23) ~40 %
  - `tree` na grass/hills (z 7–19) ~25 %
  - `stone` na cliffs (rozdíl k sousedovi ≥3) ~25 %
- [ ] **Render overlay** — procedurální Graphics ikonka nad střed tile (zatím bez sprite). `createResourceOverlay(typeId)` v `tiles.ts`.
- [ ] **Selektor (klik)** — vybraná tile = persistentní oranžový outline (vs. žlutý hover). Esc / pravý klik = deselect.
- [ ] **Akce sběru** — klik na tile s resource = resource zmizí + inventář++ (jednoklik = sběr).
- [ ] **HUD inventář** — `tree N | iron N | stone N` textově.

## Parking (až bude chuť)
- [ ] **Namalovat vlastní dlaždice** — 8 typů, šablona 128 px wide, diamond top half_h = 32 (= 2:1), bočnice depth ~32 px, transparent pozadí. Naming `{type}01.png` v `public/assets/terrain/`. Po dodání: `USE_GRAPHICS = false` v `main.ts:67`.
- [ ] **Q-diary** — DIARY.md / DONE.md / GLOSSARY.md ve stylu Stickman, nebo dál KISS?

## Later
- [ ] **Resource regenerace** — strom doroste za N sekund (vyžaduje game-clock / tick simulaci). Odložené z Fáze 2.
- [ ] Variant pool (více variant per typ, deterministic random per (i, j))
- [ ] Další žánrové prvky (těžba budovou, výroba, dopravníky, …)
- [ ] Auto-tiling (Wang / blob tiles) pro hraniční přechody

## Done
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
