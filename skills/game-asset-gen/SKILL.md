---
name: game-asset-gen
version: 1.0.0
description: >-
  Use when generating game art assets with AI — sprites, pixel art, icons,
  backgrounds, tilesets, character portraits, UI elements, or item art using
  Gemini image generation models (Nano Banano). Covers prompt engineering for
  consistent game art styles, batch generation, and asset pipeline integration.
---

# Game Asset Gen

Generate game art assets with Gemini image generation models (Nano Banano).
Covers sprites, pixel art, icons, backgrounds, tilesets, character portraits,
UI elements, and item art with consistent style across an entire game.

---

## Models Overview

| Model | ID | Best For | Speed |
|---|---|---|---|
| Nano Banano | `gemini-2.5-flash-image` | Fast iteration, prototyping | Fastest |
| Nano Banano 2 | `gemini-3.1-flash-image-preview` | Quality sprites, icons | Fast |
| Nano Banano Pro | `gemini-3-pro-image-preview` | Hero art, backgrounds, marketing | Best quality |

**Resolution options:** 512px, 1024px, 2048px, 4096px.

**Aspect ratios:**

| Ratio | Use Case |
|---|---|
| 1:1 | Icons, sprites |
| 16:9 | Backgrounds, banners |
| 3:4 | Portraits |
| 4:1 | Headers |

---

## Prompt Engineering for Games

### Style Anchors

Start every prompt with a style description. This anchors the model to a
consistent visual language:

```
pixel art, 32x32, transparent background, 16-color palette
```

```
digital illustration, painterly, fantasy RPG, warm lighting
```

### Consistency Tokens

Define the style once, then reference it in all prompts:

```
in the style of [game name] with [specific traits like "thick outlines,
2-shade cel shading, muted earth tones"]
```

### Negative Constraints

Always include what you do NOT want:

```
no text, no watermark, no realistic proportions, no gradients
```

For pixel art: `no anti-aliasing, no sub-pixel detail, no dithering`

### Asset-Specific Tips

- **Sprites** — always request transparent background, specify facing direction
- **Icons** — need clear silhouettes readable at small sizes, bold outlines
- **Backgrounds** — specify depth layers for parallax, no character elements
- **Tilesets** — must have seamless/tileable edges, consistent lighting angle
- **Portraits** — specify bust/headshot framing, expression, lighting direction

---

## Asset Types Quick Reference

| Asset Type | Model | Resolution | Aspect | Key Prompt Elements |
|---|---|---|---|---|
| Character sprite | `flash-image-preview` | 512px | 1:1 | transparent bg, full body, facing right |
| Item icon | `flash-image-preview` | 256px | 1:1 | transparent bg, centered, clear silhouette |
| Background | `pro-image-preview` | 2048px | 16:9 | depth layers, atmospheric, no characters |
| UI panel | `flash-image` | 1024px | varies | flat design, clean edges, semi-transparent |
| Portrait | `pro-image-preview` | 1024px | 3:4 | bust shot, expressive, detailed |
| Tileset | `flash-image-preview` | 512px | 1:1 | seamless edges, top-down, consistent light |
| Spell effect | `flash-image` | 512px | 1:1 | transparent bg, particle burst, vibrant |
| Status icon | `flash-image` | 256px | 1:1 | 16x16 symbol, bold, transparent bg |

---

## Multi-Turn Refinement

Gemini supports conversational image editing. Generate a base image, then
refine iteratively:

1. Generate base: "pixel art warrior sprite, 64x64, transparent background"
2. Refine: "make the sword glow blue"
3. Refine: "add a shadow beneath the character"
4. Refine: "darken the armor to gunmetal gray"

**Guidelines:**
- Each turn sends the previous image + new instruction
- Max ~5 turns before quality degrades noticeably
- Keep instructions specific and small per turn
- If quality drops, restart from a good checkpoint

---

## Batch Generation for Consistency

### Style Reference Workflow

1. Generate a **style reference image** that defines the game's visual language
2. Use that image as a reference for all subsequent asset generation
3. Include the reference image in every generation call

### Seed-Based Reproducibility

- Pass `seed` parameter for deterministic output
- Same seed + same prompt = similar (not identical) output
- Generate 4 variations, pick the best, save that seed
- Store seed alongside the asset for future regeneration

### Batch Process

1. Define a JSON manifest with all assets (name, category, prompt, model, seed)
2. Run generation script against the manifest
3. Review outputs, mark accepted/rejected
4. Re-generate rejected assets with adjusted prompts

See `references/api-usage.md` for implementation details.

---

## Pipeline Overview

```
Define Style → Create Prompts → Generate (4 variants) → Review → Refine → Export → Save
```

**Save to:** `public/assets/{category}/{name}_{variant}.png`

**Naming convention:**
- Characters: `hero_warrior_idle.png`, `enemy_slime_attack.png`
- Items: `weapon_sword_iron.png`, `potion_health_small.png`
- Backgrounds: `area_forest_day.png`, `area_dungeon_entrance.png`
- UI: `button_primary.png`, `panel_inventory.png`
- Effects: `spell_fire_01.png`, `status_poison.png`

See `references/pipeline.md` for full workflow, sprite sheet assembly, and
Next.js integration.

---

## Cost Estimation

| Model | Cost/Image (approx) | Typical Use |
|---|---|---|
| `flash-image` | ~$0.02 | Prototyping, UI elements |
| `flash-image-preview` | ~$0.04 | Production sprites, icons |
| `pro-image-preview` | ~$0.08 | Hero art, backgrounds |

Budget: ~100 assets for a small game = **$2-$8** depending on model mix.

---

## Cross-References

- **`/gemini-api-dev`** — Gemini API setup, authentication, model config
- **`/game-dev-hub`** — Game project structure, asset organization
- `references/prompt-catalog.md` — Complete prompt templates for all asset types
- `references/pipeline.md` — Full asset pipeline, sprite sheets, Next.js integration
- `references/api-usage.md` — TypeScript API code, batch scripts, error handling
