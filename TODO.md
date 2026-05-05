# TODO

## Now

(prázdné — Fáze 5.1 dokončena, čeká rozhodnutí o dalším kroku)

## Next — kandidáti na Fázi 5.2
- **Production tick** — mine se zaregistruje jako `TickingSystem` v `Sim`, každých N tiků těží IRON/STONE → inventář. **První reálný use-case sim infrastruktury.**
- **Druhý typ budovy** — ověří, že přidání nového typu je triviální (test conceptual integrity recipe / build-mode / canPlaceBuilding pipeline).
- **Demolice budovy** — UX (dedikovaný demolice mode? Shift+klik?). API už hotové (`grid.removeBuilding(id)`).
- **Movement** — postavy/budovy se hýbou, click-to-move s pathfindingem nad heightmap.
- **Nepřekonatelnost** — `IMPASSABLE_THRESHOLD` rule pro útesy (gameplay constraint).

## Later
- **Tree sway animace** — vyžaduje per-tile Graphics path nebo shader (sprite z RenderTexture nelze tween).
- **Resource regenerace** — strom doroste za N sekund (vyžaduje game-clock / tick simulaci).
- **Stone/iron varianty** — analogicky stromu (3+ provedení per typ).
- **Auto-tiling** (Wang / blob tiles) pro hraniční přechody mezi tile typy.
- **Multi-tile budovy** — až bude smysluplný use-case (rafinérie 2×2). Refaktor `Building.i,j` → `tiles[]`.

## Parking (až bude chuť)
- [ ] **Q-diary** — DIARY.md / DONE.md / GLOSSARY.md ve stylu Stickman, nebo dál KISS?
- [ ] **DRY pro `createTileSprite/createResourceSprite/createBuildingSprite`** — 3× identický kód v `tiles.ts`, refaktorovat na obecný `createCachedSprite(cache, typeId, variantIndex)`.
- [ ] Další žánrové prvky (výroba, dopravníky, sklady, …)

## Done
- [x] **Fáze 5.1 — Stavba budov: mine**
  - `src/building.ts` — typy + `canPlaceBuilding` (pure function nad `GridLike` interface, cyklus importů zlomen přes type-only)
  - `src/buildings.ts` — `Buildings` registr, `Map<id, Building>`, `register/unregister/get`
  - `src/building-recipes.ts` — `MINE_RECIPE` (low-poly drill tower: ocelový podstavec + pilíř + oranžová špička)
  - `src/build-mode.ts` — `BuildMode` třída, ghost sprite (alpha 0.55, tint bílá/červená dle validity)
  - `grid.ts` rozšíření — `tileBuilding[i][j]`, `placeBuilding/removeBuilding/getBuildingAt/getResourceAt`. `sortableChildren = true` + `zIndex = i+j` (correct z-order pro dynamicky přidávané budovy po init)
  - `input.ts` rozšíření — klávesa `B` toggle, ghost preview v hover, klik větvení (build/harvest), Esc i RMB klik (bez dragu, threshold 4 px) exit
  - `hud.ts` — `BUILD: mine` řádek viditelný jen v build módu
  - Pravidla pro mine: tile musí mít resource `IRON` nebo `STONE` + nesmí mít jinou budovu. Sedne na výšku tile (žádný flatten). Bez demolice v UX (preventivně připravený `removeBuilding` API).
- [x] **Fáze 4 — Tick simulace (kostra)**
  - `src/sim.ts` — `Sim` třída, accumulator pattern (Glenn Fiedler), `TPS = 30`, `MAX_TICKS_PER_FRAME = 60` (cap proti spirale of death), monotónní `tickCount`
  - Speed multipliery 0/1×/10×/100× (`SpeedMultiplier` type), pauza nuluje accumulator (po unpause se ticky nedoženou)
  - `TickingSystem` interface + `register()` API — zatím nikdo nezaregistrován (jen kostra)
  - Klávesy `0`/`1`/`2`/`3` v `input.ts` (`SPEED_KEYS` mapa)
  - HUD řádek `1× tick N (M/30 tps)` resp. `PAUSED tick N (0/30 tps)` — `Sim.getMeasuredTps()` přes 1s sliding window
  - Determinismus pravidlo: sim NIKDY `Math.random()` ani `performance.now()` (jen `updateMeasureWindow` smí na wall-clock kvůli display)
- [x] **Fáze 3.3 — Tree varianty + density tuning + stone shrink**
  - 5 variant stromu (jehličnatý / listnatý / 2× mini jehl. / 2× mini list. / smíšený), výběr `hash(i, j) % 5`
  - Strom 1/2 měřítka (apex max ~67 px), shadow 1/2
  - Stone 1/2 měřítka (radius i pozice půleny)
  - Resource density: iron 40 % → 5 % (vzácná); stone 25 % na cliff Δz≥2 → 30 % + 25 % na mountain (= primární horský resource)
  - Architektura: `RESOURCE_RECIPES: Recipe[][]` (= varianty per resource), reuse `buildTileCache`, smazán `buildRecipeCache`
- [x] **Fáze 3.2 — Terrain tiles jako primitive recipes**
  - `src/tile-recipes.ts` — 8 typů × 3 varianty = 24 recipes (grass/dirt/water/farmland/forest/mountain/hills/wetlands, každý s decorations: trsy trávy, kamínky, vlnky, brázdy, rákosy, skalky)
  - `primitives.ts` — přidaný `kind: 'diamond'` (= top tile face s tmavou hraně)
  - `render-cache.ts` — `buildTileCache` (univerzální 2D pole `Recipe[][] → CachedSprite[][]`)
  - `tiles.ts` — `createTileSprite(typeId, variantIndex, cache)` (sprite z cache), `createCliffGraphic` (= jen 2 boční stěny, bez top diamond — cliff je oddělená Graphics layer per tile dle z-rozdílů sousedů)
  - `grid.ts` — sprite + cliff Graphics rendrované samostatně, variant výběr `hash(i, j) % TILE_VARIANTS_PER_TYPE`
  - `main.ts` — vybudování tileCache a resourceCache po `app.init()`
  - **Smazány**: `assets.ts` (PNG loader), `procedural.ts` (procedural texture gen) — recipe path je definitivní
- [x] **Fáze 3.1 — Resource overlays jako primitive recipes**
  - `src/iso3d.ts` — projekce 3D→iso 2D (2:1 dimetric, lokální units odvozené z HALF_W/HALF_H), 3-tonal shading (top/left/right face, slunce z TL screen, lerp k bílé/černé)
  - `src/primitives.ts` — slovník: `cylinder`, `cone`, `sphere`, `blob`, `shadow` (drop shadow elipsa)
  - `src/recipes.ts` — `TREE` (kmen + 3 cones, 1:1 z TheCubes buildTree), `STONE` (5 hexagonálních blobs, 3 odstíny), `IRON` (4 blobs + 1 sphere lesk)
  - `src/render-cache.ts` — pre-render do `RenderTexture` po `app.init()`, lookup `recipeId → { texture, anchorX, anchorY }`
  - `tiles.ts` — `createResourceOverlay` (Graphics switch) → `createResourceSprite(id, cache)` (Sprite z cache)
  - `grid.ts` — typ overlay = `Sprite`, pozicování `(x, y + HALF_H)` aby lokál (0,0,0) přistál na střed top diamond. Harvest `destroy({ texture: false })` (sdílená textura).
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
