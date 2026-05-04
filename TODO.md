# TODO

## Now
- [ ] (až bude chuť) **Namalovat vlastní dlaždice** — 8 typů, šablona 128 px wide, diamond top half_h = 32 (= 2:1), bočnice depth ~32 px, transparent pozadí. Naming `{type}01.png` v `public/assets/terrain/`.
- [ ] Po dodání: `USE_GRAPHICS = false` v `main.ts:67`, ověřit že schody zmizí (= konzistentní shape).

## Next
- [ ] DIARY.md / DONE.md / GLOSSARY.md — dle preference (KISS odložené, otázka stále otevřená)
- [ ] První žánrový prvek (těžba / dopravník / stavba)

## Later
- [ ] Variant pool (více variant per typ, deterministic random per (i, j))
- [ ] Žánrové prvky (těžba, výroba, dopravníky, …)
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
