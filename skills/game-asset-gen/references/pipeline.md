# Asset Pipeline

Full workflow for generating, organizing, and integrating game assets.

---

## Workflow Steps

1. **Define style guide** — generate reference images that establish the game's
   art style (see `prompt-catalog.md` Style Guide section)
2. **Create prompt templates** — write prompts per asset category using the
   catalog as a starting point
3. **Generate 4 variations** — use `sample_count` or repeated calls with
   different seeds
4. **Review and select** — pick the best variant from each batch
5. **Refine with multi-turn** — send selected image back with edit instructions
   (up to ~5 turns)
6. **Export at final resolution** — ensure correct dimensions and format
7. **Save to project** — place in the correct assets directory

---

## File Naming Convention

```
public/assets/
├── characters/
│   ├── hero_warrior_idle.png
│   ├── hero_warrior_walk_01.png
│   ├── hero_warrior_walk_02.png
│   ├── hero_mage_idle.png
│   └── enemy_slime_idle.png
├── items/
│   ├── weapon_sword_iron.png
│   ├── weapon_staff_fire.png
│   ├── armor_plate_chest.png
│   └── potion_health_small.png
├── backgrounds/
│   ├── area_forest_day.png
│   ├── area_forest_night.png
│   ├── area_dungeon_entrance.png
│   └── area_city_market.png
├── tilesets/
│   ├── terrain_grass.png
│   ├── terrain_stone.png
│   └── terrain_water.png
├── ui/
│   ├── button_primary.png
│   ├── button_danger.png
│   ├── panel_inventory.png
│   ├── panel_dialog.png
│   └── frame_health_bar.png
└── effects/
    ├── spell_fire_01.png
    ├── spell_fire_02.png
    ├── hit_slash_01.png
    └── status_poison.png
```

### Naming Rules

- All lowercase, underscores for spaces
- Pattern: `{category}_{name}_{variant}.png`
- Animation frames: `{name}_{frame:02d}.png` (e.g., `walk_01.png`)
- Variations: `{name}_{variant}.png` (e.g., `sword_iron.png`, `sword_gold.png`)

---

## Sprite Sheet Assembly

### CSS Sprites for Web Games

Combine individual icons into a single image and use `background-position`:

```typescript
import { createCanvas, loadImage } from 'canvas';
import { writeFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';

const CELL_SIZE = 32;
const COLS = 8;

async function buildSpriteSheet(inputDir: string, outputPath: string) {
  const files = (await readdir(inputDir)).filter(f => f.endsWith('.png'));
  const rows = Math.ceil(files.length / COLS);
  const canvas = createCanvas(COLS * CELL_SIZE, rows * CELL_SIZE);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < files.length; i++) {
    const img = await loadImage(`${inputDir}/${files[i]}`);
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    ctx.drawImage(img, col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  }

  const buffer = canvas.toBuffer('image/png');
  await writeFile(outputPath, buffer);

  // Generate CSS mapping
  const css = files.map((file, i) => {
    const name = file.replace('.png', '');
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return `.icon-${name} { background-position: -${col * CELL_SIZE}px -${row * CELL_SIZE}px; }`;
  }).join('\n');

  await writeFile(outputPath.replace('.png', '.css'), css);
  console.log(`Sprite sheet: ${files.length} sprites, ${COLS}x${rows} grid`);
}
```

### Texture Atlas (Bin-Packing)

For variable-size sprites, use a bin-packing algorithm:

```typescript
interface Sprite {
  name: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
}

function packSprites(sprites: Sprite[], atlasWidth: number): { height: number; packed: Sprite[] } {
  const sorted = [...sprites].sort((a, b) => b.height - a.height);
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  for (const sprite of sorted) {
    if (x + sprite.width > atlasWidth) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    sprite.x = x;
    sprite.y = y;
    x += sprite.width;
    rowHeight = Math.max(rowHeight, sprite.height);
  }

  return { height: y + rowHeight, packed: sorted };
}
```

### Simple Fixed Grid

For uniform sprites, use a fixed grid layout — all cells the same size
(e.g., 32x32). Simplest approach, works with most game engines.

---

## Next.js Image Optimization

### Using next/image

```tsx
import Image from 'next/image';

function GameSprite({ src, alt, size = 64 }: { src: string; alt: string; size?: number }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
      priority={false}
    />
  );
}
```

### Critical: Pixel Art Rendering

Always add `imageRendering: 'pixelated'` for pixel art assets. Without this,
browsers will blur scaled pixel art:

```css
.pixel-art {
  image-rendering: pixelated;
  image-rendering: crisp-edges; /* Firefox fallback */
}
```

### Multi-Resolution Generation

Generate assets at 1x and 2x for retina displays:

```typescript
// Generate at 2x, display at 1x
// A 32x32 sprite → generate at 64x64, display in 32x32 container
const sizes = [
  { suffix: '', scale: 1 },
  { suffix: '@2x', scale: 2 },
];
```

### WebP Conversion

Convert PNGs to WebP for smaller file sizes (use Sharp):

```typescript
import sharp from 'sharp';

async function convertToWebP(inputPath: string, outputPath: string) {
  await sharp(inputPath)
    .webp({ quality: 90, lossless: true }) // lossless for pixel art
    .toFile(outputPath);
}
```

---

## Version Control Strategy

### DO NOT Commit Large Binary Assets to Git

Binary images bloat the repository. Instead:

1. **Track prompts, not images** — store prompt files (JSON/YAML) with prompt
   text, seed, model, and parameters
2. **Regenerate from prompts** — assets are reproducible with the same seed
3. **Use Git LFS** for assets that must be versioned

### Prompt Manifest File

```json
{
  "assets": [
    {
      "name": "hero_warrior_idle",
      "category": "characters",
      "model": "gemini-3.1-flash-image-preview",
      "seed": 42,
      "prompt": "pixel art character sprite, 64x64, warrior hero, plate armor with tower shield, transparent background, front-facing, idle pose, 16-bit style, clean outlines, no text, no watermark"
    },
    {
      "name": "weapon_sword_iron",
      "category": "items",
      "model": "gemini-3.1-flash-image-preview",
      "seed": 123,
      "prompt": "pixel art iron sword, 32x32 icon, transparent background, centered, slight glow effect, fantasy style, clean edges, no text"
    }
  ]
}
```

### .gitignore Pattern

```gitignore
# Generated game assets (regenerate from prompts)
public/assets/generated/

# Keep prompt manifests
!public/assets/**/*.json
```

---

## Cost Estimation

| Model | Cost/Image (approx) | Typical Use |
|---|---|---|
| `gemini-2.5-flash-image` | ~$0.02 | Prototyping, UI elements |
| `gemini-3.1-flash-image-preview` | ~$0.04 | Production sprites, icons |
| `gemini-3-pro-image-preview` | ~$0.08 | Hero art, backgrounds |

### Budget Planning

| Game Size | Asset Count | Model Mix | Estimated Cost |
|---|---|---|---|
| Prototype | ~20 assets | All flash | ~$0.40 |
| Small game | ~100 assets | 70% flash, 30% pro | $2-$4 |
| Medium game | ~300 assets | 60% flash, 40% pro | $8-$15 |
| Large game | ~1000 assets | Mixed | $25-$50 |

**Note:** Costs include ~4 variations per asset for selection. Refinement
turns add additional cost per image.
