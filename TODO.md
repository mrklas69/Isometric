# TODO

## Now

(prázdné — Fáze 5.4 dokončena, čeká rozhodnutí o dalším kroku)

## Next — kandidáti na Fázi 5.5
- **Demolice budovy** — UX (dedikovaný demolice mode? Shift+klik?). API už hotové (`grid.removeBuilding(id)`).
- **Visual feedback produkce** — particle / animace nad mine když produkuje (ne když je full nebo paused).
- **Visual feedback depletion** — resource sprite se zmenšuje úměrně zbytku (5 fází u stromu by vystihlo, iron/stone by potřeboval intermediate variants).
- **Multi-resource sklad** — Storage drží `Map<ResourceId, number>` místo single-type slotu (= Factorio chest s víc sloty).
- **Movement** — postavy/budovy se hýbou, click-to-move s pathfindingem nad heightmap.
- **Nepřekonatelnost** — `IMPASSABLE_THRESHOLD` rule pro útesy (gameplay constraint).
- **Rename Inventory → Stockpile?** — globální resource pool je koncepčně sklad, ne hráčova kapsa. Až bude HQ/sklad budova, refactor.

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
- [x] **Fáze 5.4 — Resource depletion**
  - `src/resource.ts` — konstanta `RESOURCE_INITIAL_AMOUNT[id]: readonly number[]` = `[1, 100, 200]` (TREE, IRON, STONE). Sanity check délky = `RESOURCE_TYPES.length`. Tree=1 zachová původní "1 klik = pryč" chování harvestu, iron 100 = 200 s při 1× speed, stone 200 = 400 s.
  - `src/grid.ts` — nové pole `tileResourceAmount: number[][]` paralelně k `tileResource`. Init z `RESOURCE_INITIAL_AMOUNT[type]` při worldgen, 0 pokud žádný resource. Nová metoda `decrementResource(i, j): boolean` — sníží amount o 1, na 0 destroy sprite + `tileResource[i][j]=null`. Vrátí false pokud byl už 0 (= mine signál "nic neprodukuj"). Nová `getResourceAmountAt(i, j): number`. Refactor `harvest()` → volá `decrementResource()` místo duplicitní logiky (DRY).
  - `src/mine-system.ts` — konstruktor přijímá `Grid`. Před inkrementem `output.amount` zavolá `grid.decrementResource(b.i, b.j)` — pokud false, mine nic neprodukuje. Po N produkcích (= INITIAL_AMOUNT) tile vyčerpaný, mine zůstává s aktuálním obsahem k vyzvednutí, ale produkce stojí.
  - `src/main.ts` — `new MineSystem(buildings, grid)` (grid předán pro depletion check).
  - `src/hud.ts` — `formatHover()` rozšířen o resource část `[<typeName>: <amount>]` (Fáze 5.4). Symetrický se [building info]: `(i, j) z=N name [iron: 85] [mine: iron 12/50]`. Po vyčerpání resource part zmizí (= visual feedback depletion). Storage tile bez resource → jen [storage] part.
  - **Důsledek pro placement:** po vyčerpání tile `canPlaceBuilding(MINE)` vrátí false (vyžaduje IRON/STONE resource), tj. nelze postavit nový mine na vyčerpané místo. Žánrově korektní — vytěžená lokace je permanentně "vyhořelá".
- [x] **Fáze 5.3 — Storage (druhý typ budovy)**
  - `src/building.ts` — nová konstanta `BUILDING_STORAGE = 1`, rozšíření `BUILDING_TYPES` (sanity check 2 typy), `STORAGE_CAPACITY = 200` (4× mine cap). `OutputSlot.type` z `readonly number` → `number | null` (mutable) — sklad může mít prázdný slot bez committed type, mine type stále nastavený při placement. `GridLike` rozšířen o `getTypeAt(i, j)`. `canPlaceBuilding` pro storage: NOT water, NOT mountain, NOT resource, NOT building (passable infrastructure rule).
  - `src/building-recipes.ts` — `STORAGE_RECIPE`: silo s béžovým válcovým tělem (ENDESGA32[2]) + sytá červená kuželová střecha (ENDESGA32[8]) s mírným přesahem (r 0.32 > body 0.28). 3 primitiva (shadow + cylinder + cone). Apex 0.73 lokál units = nižší ale širší silhouette než mine (0.95).
  - `src/build-mode.ts` — `toggle()` → `toggle(typeId)` tří-stavová logika: !active → activate, active+stejný typ → exit, active+jiný typ → switch ghost texture (= B/N přepínač bez nutnosti Esc). Privátní `setSelectedType(typeId)` aktualizuje texture + anchor z cache.
  - `src/grid.ts` — `placeBuilding` per typ branch: MINE → output `{type: resourceFromTile, …}`, STORAGE → output `{type: null, amount: 0, capacity: 200}`. Nová API: `depositToStorage(i, j, type, amount): number` (vrací uložené kusy, clamp na free; type conflict → 0), `withdrawFromStorage(i, j): {type, amount} | null` (vyzvedne vše, slot.type → null). `collectMineOutput` defensive null check (mine type je vždy non-null, ale typ pole to dovoluje).
  - `src/input.ts` — klávesa `N` → `buildMode.toggle(BUILDING_STORAGE)`, klávesa `B` → `toggle(BUILDING_MINE)` (sjednocená API). Click v harvest módu větvení dle `building.typeId`: mine → existing `collectMineOutput`, storage → nová `handleStorageClick`. Deposit-or-withdraw single-click toggle: pokud sklad má typ a inventory[type] > 0 → deposit; pokud sklad prázdný → deposit dominantní typ (max amount); jinak withdraw vše.
  - `src/hud.ts` — `formatHover` handle storage `output.type === null` → `[storage: empty 0/200]` (vs. `[storage: iron 45/200]` po deposit).
- [x] **Fáze 5.2 — Production tick (Mine output slot)**
  - `src/building.ts` — typ `OutputSlot { type, amount, capacity }` + rozšíření `Building.output: OutputSlot | null`. Konstanty `MINE_OUTPUT_CAPACITY = 50`, `MINE_TICKS_PER_UNIT = 60` (= 2 s real-time per unit při 1×).
  - `src/buildings.ts` — `register()` vezme volitelný `output`, přidána `all()` iterace pro tick systémy.
  - `src/grid.ts` — `placeBuilding` sestaví `OutputSlot` z `tileResource[i][j]` (Mine produkuje přesně to, co tile má). Nové `getBuilding(i,j)` + `collectMineOutput(i,j)` (vyzvedne celý slot, vrátí `{type, amount}` nebo null).
  - `src/mine-system.ts` — nový `MineSystem implements TickingSystem`. Modulo rate-limit (`tickCount % MINE_TICKS_PER_UNIT === 0`) — všechny doly produkují synchronně, izomorfně. Cap na capacity (full = stagnuje, žánrový tlak na transport).
  - `src/main.ts` — `sim.register(new MineSystem(buildings))` (první reálný TickingSystem nad Sim infrastrukturou z Fáze 4).
  - `src/input.ts` — klik na mine v harvest módu vyzvedne output slot do `Inventory`. Větvení: budova → pickup, jinak resource → harvest. Resource pod minou se ručním klikem nesklízí (= budova má přednost, conceptual integrity).
  - `src/hud.ts` — předán `Grid` do konstruktoru, `formatHover()` skládá hover text per-frame z live dat (output amount musí růst i bez pohybu myši). Display: `(i, j) z=N name [mine: iron 12/50]`.
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
