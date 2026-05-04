# Asset Brief — Isometric Terrain Tileset

> Dokument pro 3rd-party asset creation (AI image generators / ilustrátoři).
> Cíl: vyrobit izometrické dlaždice terénu, které se dají bez retuše použít v projektu Isometric.

## Technická specifikace

| Parametr | Hodnota |
|---|---|
| **In-game tile rozměr** | **128 × 64 px** (cílový po resize/crop) |
| **Generační rozměr** | **1024 × 1024 px** (čtverec, tile vyplňuje ~90 % rámu) |
| **Projekce** | **2:1 dimetrická EXACT** (= half_w / half_h = 2 / 1, pixel-aligned) |
| **Tvar horní plochy** | diamond (kosočtverec) **konzistentní napříč všemi typy** |
| **Hloubka (boční stěny)** | ~10–15 % šířky tile (= cube-like výška) |
| **Pozadí** | **plné #ff00ff (magenta)** — pro chroma-key removal |
| **Anti-aliasing** | minimální / hard edges (snižuje magenta-bleed při masku) |
| **Formát** | PNG (lossless) |
| **Naming** | `{type}{NN}.png` — `grass01.png`, `grass02.png`, …, `forest01.png` |
| **Variant per typ** | 3–5 (pro variant pool, tile selection deterministic z pozice) |

**KRITICKÉ — z lessons learned (atlas v1):** všechny tile MUSÍ mít **STEJNÝ tvar diamondu** (= stejné poměry, stejné úhly) napříč typy. Atlas v1 měl per-typ různé úhly (forest měl strmější diamond než water) → sprite render driftoval. V promptu výslovně požaduj:

> "All 8 tiles MUST have the EXACT SAME diamond top shape — identical width-to-height ratio, identical edge angles. The 2:1 dimetric proportion (= top width = 2× top height) must be PIXEL-PERFECT and IDENTICAL across all tiles. Treetops/peaks/reeds may extend ABOVE the diamond top corner, but the diamond outline itself must be a strict 2:1 rhombus identical across the set."

## Vizuální reference

- `.source/gemini_isometric_game.png` — cílový styl: cartoon, painterly, viditelná výškovka
- `.source/a_isometric_tile_grid_.png` — pixel-art varianta (alternativa)
- `.source/b_isometric_tile_grid_.jpeg` — detailnější rendered

## Paleta — Endesga 32

CC0 paleta používaná v projektu. Generátor **nemusí** trefit přesně, ale dominantní tóny ať padnou do těchto hex:

```
Greens   : #63c74d  #3e8948  #265c42
Earths   : #b86f50  #733e39  #e4a672  #ead4aa
Stones   : #c0cbdc  #8b9bb4  #5a6988  #3a4466
Blues    : #2ce8f5  #0099db  #124e89  #193c3e
Accents  : #fee761  #feae34  #f77622
```

## Seznam terénů (terrain pack)

Pro **terrain pack** request — minimální set:

| Typ | Popis | Endesga hint |
|---|---|---|
| `grass` | Krátká zelená tráva, pár drobných trsů | `#3e8948` + `#265c42` |
| `dirt` | Holá hnědá hlína, drobné prasklinky, ojedinělý kamínek | `#b86f50` + `#733e39` |
| `water` | Klidná modrá hladina, jemné vlnky, lehký lesk vlevo nahoře | `#0099db` + `#124e89` |
| `farmland` | Zorané řádky tmavé půdy, jemné body sazenic | `#733e39` + `#3e8948` |
| `forest` | Hustá koruna z ptačí perspektivy, vrcholky stromů přesahují siluetu | `#265c42` + `#193c3e` |
| `mountain` | Skalnatý šedý vrchol vystupující ze základny, sníh na špičce volitelně | `#5a6988` + `#c0cbdc` |
| `hills` | Mírný travnatý kopeček, hladce zaoblený vršek | `#3e8948` + `#63c74d` |
| `wetlands` | Bahnitý mokrý povrch, trsy rákosu, lesklé kaluže | `#5a6988` + `#3e8948` |
| `sand` *(opt)* | Světlá písčitá pláž, lehké vlnky | `#ead4aa` + `#e4a672` |
| `stone` *(opt)* | Plochá kamenná dlažba, drobné spáry | `#8b9bb4` + `#5a6988` |
| `snow` *(opt)* | Čerstvý sníh, jemné stíny v prohlubních | `#ffffff` + `#c0cbdc` |

---

## Prompt — UNIVERZÁLNÍ ŠABLONA (per-tile)

> Nejlepší kvalita: **jedna generace = jedna dlaždice**. Jednoduše opakuj s vyměněným `{{TERRAIN}}` a `{{DETAILS}}`.

```
A single isometric video game terrain tile, 2:1 dimetric projection.
Subject: {{TERRAIN}} — {{DETAILS}}.

Shape: diamond-shaped top surface (rhomboid), with a short cube-like
depth on the lower edges (~12% of tile width). Hard, clean silhouette.

Style: cartoon, painterly, hand-rendered, mid-saturation. Reference
games: Wargroove, Triangle Strategy, Stardew Valley, Settlers Online.
Lit from upper-left; soft self-shadow on the right and bottom-right
side faces. No cast shadow on background.

Color palette inspired by Endesga 32. Dominant hues for this tile:
{{ENDESGA_HINT}}.

Background: solid uniform #ff00ff magenta — fully covering the canvas
outside the tile. NO gradient, NO grid, NO text, NO border, NO drop
shadow on the background. Hard pixel-perfect edges between the tile
and the magenta — minimal anti-aliasing on the silhouette.

Composition: tile centered, fills ~90% of the canvas. Square 1024×1024.
The full diamond outline must be visible (no part cropped by the canvas
edge).
```

### Placeholdery — vyplň před spuštěním

| Token | Příklad pro `forest` |
|---|---|
| `{{TERRAIN}}` | `dense forest canopy` |
| `{{DETAILS}}` | `seen from above, treetops bulge slightly above the tile silhouette, mix of dark and medium greens, occasional lighter highlight on a treetop` |
| `{{ENDESGA_HINT}}` | `dark forest green #265c42, deep teal #193c3e, accent green #3e8948` |

### Předpřipravené varianty pro celý terrain pack

#### grass
- `{{TERRAIN}}`: `short grass meadow`
- `{{DETAILS}}`: `even green coverage, 3–4 small darker grass tufts, no flowers, no rocks`
- `{{ENDESGA_HINT}}`: `medium green #3e8948, darker green #265c42, lighter green #63c74d`

#### dirt
- `{{TERRAIN}}`: `bare dirt ground`
- `{{DETAILS}}`: `dry brown earth, faint cracks, 1–2 tiny pebbles, no grass`
- `{{ENDESGA_HINT}}`: `warm brown #b86f50, dark brown #733e39, sandy tan #e4a672`

#### water
- `{{TERRAIN}}`: `calm water surface`
- `{{DETAILS}}`: `gentle wave ripples, soft specular highlight in upper-left, semi-translucent feel`
- `{{ENDESGA_HINT}}`: `bright cyan #0099db, deep blue #124e89, foam highlight #2ce8f5`

#### farmland
- `{{TERRAIN}}`: `plowed farmland field`
- `{{DETAILS}}`: `parallel furrows of tilled dark earth, faint green sprout dots in rows, neat geometry`
- `{{ENDESGA_HINT}}`: `dark soil #733e39, sprout green #3e8948, warm earth #b86f50`

#### forest
- `{{TERRAIN}}`: `dense forest canopy`
- `{{DETAILS}}`: `treetops viewed from above, slight 3D bulge above the tile silhouette, mix of dark and medium greens, occasional bright highlight on a single treetop`
- `{{ENDESGA_HINT}}`: `dark forest green #265c42, deep teal #193c3e, accent green #3e8948`

#### mountain
- `{{TERRAIN}}`: `rocky mountain peak`
- `{{DETAILS}}`: `grey craggy stone rising prominently from the tile base, sharp ridges, optional white snow cap on the very top, slight ambient occlusion at the base`
- `{{ENDESGA_HINT}}`: `mid blue-grey #5a6988, light grey #8b9bb4, snow white #c0cbdc`

#### hills
- `{{TERRAIN}}`: `gentle grass-covered hill`
- `{{DETAILS}}`: `smooth rounded green mound, soft side-lighting, no rocks, no trees, just a soft bump`
- `{{ENDESGA_HINT}}`: `medium green #3e8948, lighter green #63c74d, shadow green #265c42`

#### wetlands
- `{{TERRAIN}}`: `marshy wetlands`
- `{{DETAILS}}`: `muddy waterlogged ground, 2–3 patches of tall reeds or grass tufts, glints of standing water reflecting the sky, mossy texture`
- `{{ENDESGA_HINT}}`: `muddy olive #5a6988, marsh green #3e8948, water glint #2ce8f5`

#### sand *(volitelné)*
- `{{TERRAIN}}`: `light sandy beach`
- `{{DETAILS}}`: `pale yellow-tan sand, gentle wave-like ripples in the surface, no shells, no footprints`
- `{{ENDESGA_HINT}}`: `light tan #ead4aa, warm sand #e4a672, shadow #b86f50`

#### stone *(volitelné)*
- `{{TERRAIN}}`: `stone tile floor`
- `{{DETAILS}}`: `flat grey stone slab, faint grout lines along edges, slightly weathered`
- `{{ENDESGA_HINT}}`: `light stone #8b9bb4, dark grout #5a6988, highlight #c0cbdc`

#### snow *(volitelné)*
- `{{TERRAIN}}`: `fresh snow cover`
- `{{DETAILS}}`: `soft white snow surface, gentle blue shadows in dimples, slight sparkle, no footprints`
- `{{ENDESGA_HINT}}`: `pure white #ffffff, cool shadow #c0cbdc, deep shadow #8b9bb4`

---

## Prompt — VARIANTA: atlas / sheet (rychlejší, méně kontroly)

> Pokud chceš všechny tile najednou na jednom plátně. Méně přesné, ale ušetří čas.

```
A reference sheet of 8 isometric video game terrain tiles arranged
in a 4×2 grid on a solid #ff00ff magenta background. Each tile is
2:1 dimetric projection, diamond-shaped top with short cube-like depth.

Tiles in order, left-to-right, top-to-bottom:
1. grass — short green meadow
2. dirt — bare brown earth
3. water — calm blue surface with ripples
4. farmland — plowed field with dark furrows
5. forest — dense green tree canopy from above
6. mountain — rocky grey peak
7. hills — gentle green mound
8. wetlands — marshy ground with reeds

Style: cartoon, painterly, hand-rendered (Wargroove / Triangle Strategy
reference). Lit from upper-left. Endesga 32 inspired palette. Each tile
clearly separated by ~50px of magenta gutter. No labels, no text, no
borders around tiles. Hard pixel-perfect tile silhouettes.

Canvas: 2048×1024 (4 wide × 2 tall, each tile ~512×512 area).
```

---

## Generátorové tipy

| Generátor | Poznámka |
|---|---|
| **DALL-E 3** (ChatGPT / API) | Umí přímo transparentní pozadí — můžeš nahradit "#ff00ff magenta" za "transparent background, alpha channel". Natural language friendly. |
| **Midjourney v6+** | Použij `--ar 1:1` + `--style raw` pro méně stylizace. Background often bleeds — magenta je nutnost. |
| **Stable Diffusion / SDXL** | Tag-style; přidej `((isometric tile))`, `((magenta background:1.4))`, `(no border:1.2)`. Negativ prompt: `text, label, watermark, photo, realistic, perspective`. |
| **Gemini Imagen / Nano Banana** | Drží close-to-prompt. Stejný text jako DALL-E 3. |

---

## Post-processing checklist

Po vygenerování každého obrázku:

1. **Ověř magenta čistotu** — open v image editoru, color-pick pozadí. Pokud je `#ff05f0` místo `#ff00ff`, použij chroma key s tolerancí ±10.
2. **Alpha mask** — magenta → transparent. (GIMP: `Color → Color to Alpha`. Photoshop: `Select → Color Range → magenta → mask`.)
3. **Crop** na bounding box tile + ~5 px padding.
4. **Resize** na cílových 128×64 (Lanczos / bicubic). Pro retina display si nech i 256×128 variantu.
5. **Edge cleanup** — pokud AA nechá magenta-tinted pixely na okrajích, ručně přemaluj nebo aplikuj despill.
6. **Pojmenuj** podle convention: `grass01.png`, `grass02.png`, …
7. **Ulož** do `assets/terrain/`.

---

## Rychlý workflow

1. Pro každý typ z tabulky výše spusť per-tile prompt **3–5×** (každá generace = nová varianta).
2. Vyber 3–5 nejlepších výsledků per typ → post-process → drop do `assets/terrain/`.
3. V `src/palette.ts` rozšiř `TILE_TYPES` o aktualizovaný seznam (pokud se liší od MVP 10).
4. V `src/tiles.ts` zaměň `createTileGraphic` (Graphics) za `createTileSprite` (Sprite z textury).
