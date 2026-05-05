# TODO

## Now — Fáze 2: Mapa žije

### 2.1 Heightmap & render
- [ ] **Datový model výšky** — `Tile.z: number` (integer 0–15) v `grid.ts`. Per-tile.
- [ ] **Generátor výšky** — `noise.ts` s vlastním value-noise (deterministic, seedovaný; bez external dependencies). 2 oktávy (low-freq + high-freq).
- [ ] **Mapping height → tile type** — pásma: `0–3 water`, `4 sand`, `5–9 grass`, `10–13 hills`, `14–15 mountain`. Plus jemný noise pro variace uvnitř pásma (`forest`, `dirt`, `farmland`, `wetlands`).
- [ ] **Render: screen Y offset** — `screenY -= z * PIXELS_PER_LEVEL` (8 px). Update `iso.ts` API.
- [ ] **Cliff faces** — když soused má nižší z, render obdélník (cliff side) v hlubší barvě stone. Pro oba viditelné směry (right + bottom-right v izometrii).
- [ ] **Render order** — sort `(i+j) ASC, z DESC` aby vyšší tiles překreslily nižší.
- [ ] **Pickování s výškou** — kurzor → najít tile s nejvyšším z, jehož diamond pokrývá kurzor (raycasting odshora). Update `input.ts`.
- [ ] **Vizuální QA** — vizuálně ověřit: vznikají vodní plochy (z<4), nízké kopce (5–9), vysoké útesy (rozdíl 5+ mezi sousedy), kaňony (úzký pás low-z mezi high-z).

### 2.2 Resource layer & sběr (po 2.1)
- [ ] **Datový model resource** — `Tile.resource: Resource | null`, typy: `tree`, `iron`, `stone`.
- [ ] **Generování resource** — deterministic dle (i,j) hash + height/type rules: `iron` na mountain (z≥14), `tree` na grass/hills (z 5–13), `stone` na cliffs (rozdíl k sousedu ≥5) nebo dirt.
- [ ] **Render overlay** — procedurální Graphics ikonka nad střed tile (zatím bez sprite).
- [ ] **Selektor (klik)** — vybraná tile, žlutý outline, persistentní (na rozdíl od hover).
- [ ] **Akce sběru** — klik na vybranou tile s resource → resource zmizí, globální inventář++.
- [ ] **HUD inventář** — `🪵 N | ⛏ N | 🪨 N` textově (ikony emoji nebo zkratky).

## Parking (až bude chuť)
- [ ] **Namalovat vlastní dlaždice** — 8 typů, šablona 128 px wide, diamond top half_h = 32 (= 2:1), bočnice depth ~32 px, transparent pozadí. Naming `{type}01.png` v `public/assets/terrain/`. Po dodání: `USE_GRAPHICS = false` v `main.ts:67`.
- [ ] **Q-diary** — DIARY.md / DONE.md / GLOSSARY.md ve stylu Stickman, nebo dál KISS?

## Later
- [ ] **Resource regenerace** — strom doroste za N sekund (vyžaduje game-clock / tick simulaci). Odložené z Fáze 2.
- [ ] Variant pool (více variant per typ, deterministic random per (i, j))
- [ ] Další žánrové prvky (těžba budovou, výroba, dopravníky, …)
- [ ] Auto-tiling (Wang / blob tiles) pro hraniční přechody

## Done
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
