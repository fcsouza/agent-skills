# Prompt Catalog

Complete prompt templates for game asset generation. Replace bracketed
placeholders `[like this]` with your specific values.

---

## Characters

### Hero Sprite

```
pixel art character sprite, 64x64, [class] hero, [equipment description],
transparent background, front-facing, idle pose, 16-bit style, clean outlines,
no text, no watermark
```

**Examples:**
- `[class]` = warrior, mage, rogue, ranger, cleric
- `[equipment]` = plate armor with tower shield, flowing robes with staff

### Enemy Sprite

```
pixel art monster, 64x64, [type] creature, menacing pose, [color scheme],
transparent background, retro RPG style, no text, no watermark
```

**Examples:**
- `[type]` = slime, skeleton, goblin, dragon, ghost
- `[color scheme]` = dark purple and green, fiery orange and black

### NPC Portrait

```
digital illustration, portrait bust, [race] [gender] [role], [expression],
[clothing], painted style, fantasy RPG, warm lighting, no text, no watermark
```

**Examples:**
- `[race] [gender] [role]` = elven female merchant, dwarven male blacksmith
- `[expression]` = friendly smile, stern gaze, mysterious smirk
- `[clothing]` = leather apron, silk robes with gold trim

### Boss

```
pixel art boss monster, 128x128, [type], imposing scale, glowing [element]
effects, detailed shading, transparent background, no text, no watermark
```

**Examples:**
- `[type]` = ancient dragon, undead king, corrupted treant
- `[element]` = fire, ice, shadow, lightning

### Walk Cycle Frame

```
pixel art character sprite, 64x64, [class] hero, [equipment], transparent
background, side-facing, walk cycle frame [1-4] of 4, 16-bit style
```

---

## Items

### Weapon

```
pixel art [weapon type], 32x32 icon, transparent background, centered, slight
glow effect, fantasy style, clean edges, no text
```

**Examples:**
- `[weapon type]` = iron sword, fire staff, wooden bow, crystal dagger

### Armor

```
pixel art [armor type], 32x32 icon, transparent background, metallic sheen,
[material] texture, no text
```

**Examples:**
- `[armor type]` = plate chestpiece, leather boots, chain mail helmet
- `[material]` = steel, leather, mithril, bone

### Potion

```
pixel art potion bottle, 32x32 icon, [color] liquid, transparent background,
glass reflection, glowing, no text
```

**Examples:**
- `[color]` = red (health), blue (mana), green (stamina), purple (experience)

### Currency

```
pixel art gold coin, 32x32, shiny, transparent background, slight spin shadow,
embossed symbol, no text
```

### Material / Crafting

```
pixel art [material name], 32x32, transparent background, recognizable shape,
clean outlines, no text
```

**Examples:**
- `[material name]` = iron ore chunk, blue crystal shard, ancient wood plank

### Treasure Chest

```
pixel art treasure chest, 32x32, [state] state, wooden with iron bands,
transparent background, no text
```

- `[state]` = closed, open, glowing

---

## Environment

### Forest Background

```
pixel art forest landscape, 16:9 aspect ratio, layered parallax depth,
[time of day], atmospheric fog, no characters, tileable edges, no text,
no watermark
```

**Examples:**
- `[time of day]` = golden hour sunset, misty morning, moonlit night

### Dungeon

```
pixel art dungeon interior, 16:9, stone walls, torch lighting, dark atmosphere,
moody, no characters, no text, no watermark
```

### City

```
pixel art medieval city, 16:9, bustling streets suggestion, rooftops, market
stalls, warm colors, no characters in foreground, no text, no watermark
```

### Underwater

```
pixel art underwater scene, 16:9, coral reef, light rays from surface, bubbles,
aquatic plants, blue-green color palette, no text, no watermark
```

### Tileset

```
pixel art tileset, 32x32 tiles, [terrain type], seamless edges, top-down view,
consistent lighting from top-left, no text
```

**Examples:**
- `[terrain type]` = grass and dirt, stone dungeon floor, snow and ice, sand

### Parallax Layer

```
pixel art [layer description], 16:9, transparent background where applicable,
designed as parallax [layer position] layer, no text
```

- `[layer position]` = far background, mid background, foreground

---

## UI

### Button

```
pixel art UI button, rounded rectangle, [color] gradient, slight bevel, clean
edges, transparent background, no text
```

**Examples:**
- `[color]` = blue (primary), green (confirm), red (danger), gray (disabled)

### Panel / Frame

```
pixel art UI panel frame, ornate border, [material] texture, semi-transparent
center, medieval fantasy style, no text
```

**Examples:**
- `[material]` = dark wood, stone, gold-trimmed iron

### Health Bar

```
pixel art health bar frame, horizontal, ornate end caps, inner gradient from
green to red, medieval fantasy style, transparent background, no text
```

### Resource Icon

```
pixel art [resource] icon, 24x24, simple recognizable symbol, transparent
background, bold colors, no text
```

**Examples:**
- `[resource]` = gold coin, gem, energy bolt, star, heart

### Notification Badge

```
pixel art notification badge, circular, red with white number, slight glow,
transparent background, no text
```

### Dialog Box

```
pixel art dialog box frame, rectangular, ornate corners, parchment texture
center, semi-transparent, medieval style, no text
```

### Minimap Frame

```
pixel art minimap frame, square with ornate border, compass rose in corner,
dark background, fantasy style, no text
```

---

## Effects

### Spell Effect

```
pixel art [element] spell effect, transparent background, particle burst,
vibrant [color], animation frame [N] of 4, no text
```

**Examples:**
- `[element]` = fire, ice, lightning, healing, shadow
- `[color]` = orange-red, cyan-blue, yellow-white, green, purple

### Status Icon

```
pixel art status effect icon, 16x16, [effect name] symbol, transparent
background, [color] tint, no text
```

**Examples:**
- `[effect name]` = poison (green skull), burn (flame), frozen (snowflake)
- `[color]` = green, orange, blue, purple

### Hit Effect

```
pixel art hit impact effect, 32x32, transparent background, white and [color]
sparks, radial burst, frame [N] of 3, no text
```

### Particle

```
pixel art [particle type], 8x8, transparent background, simple shape, bright
[color], no text
```

- `[particle type]` = spark, bubble, leaf, snowflake, ember

---

## Style Guide for Consistency

### Master Style Reference Prompt

Generate this image first and use it as a reference for all other assets:

```
pixel art style reference sheet showing: one character (warrior), one item
(sword), one tile (grass), one UI element (button), and one effect (fire),
all in consistent [art style description], [color palette description],
arranged in a grid, labeled sections, clean presentation
```

### Color Palette Definition

Define 16-32 colors for the game. Include hex values:

```
Game palette: #1a1c2c (dark), #5d275d (purple), #b13e53 (red), #ef7d57 (orange),
#ffcd75 (yellow), #a7f070 (green), #38b764 (dark green), #257179 (teal),
#29366f (navy), #3b5dc9 (blue), #41a6f6 (light blue), #73eff7 (cyan),
#f4f4f4 (white), #94b0c2 (light gray), #566c86 (gray), #333c57 (dark gray)
```

### Style Rules

| Property | Small Sprites (<=32px) | Large Sprites (>=64px) | Backgrounds |
|---|---|---|---|
| Line weight | 1px | 2px | None (painterly) |
| Shading levels | 2 per color | 3 per color | Gradient |
| Anti-aliasing | No | Minimal | Yes |
| Detail level | Minimal, iconic | Moderate | High |

### Perspective Rules

| Asset Type | Perspective |
|---|---|
| Tilesets | Top-down (3/4 view optional) |
| Characters | Side view |
| Portraits | Front-facing |
| Items/Icons | Front-facing, flat |
| Backgrounds | Side view with depth |
