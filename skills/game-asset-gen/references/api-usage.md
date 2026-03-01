# API Usage

TypeScript implementation for Gemini image generation in game asset pipelines.

---

## Setup

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

---

## Text-to-Image Generation

```typescript
import { GoogleGenAI } from '@google/genai';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface GenerateAssetOptions {
  prompt: string;
  model?: string;
  outputPath: string;
  seed?: number;
}

async function generateAsset({
  prompt,
  model = 'gemini-2.5-flash-image',
  outputPath,
  seed,
}: GenerateAssetOptions): Promise<void> {
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(seed !== undefined && { seed }),
    },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData,
  );

  if (!imagePart?.inlineData) {
    throw new Error('No image returned in response');
  }

  const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  console.log(`Saved: ${outputPath}`);
}
```

### Usage

```typescript
await generateAsset({
  prompt: 'pixel art warrior sprite, 64x64, transparent background, idle pose, 16-bit style, no text',
  model: 'gemini-3.1-flash-image-preview',
  outputPath: 'public/assets/characters/hero_warrior_idle.png',
  seed: 42,
});
```

---

## Image Editing (Multi-Turn)

Send a previously generated image back with edit instructions:

```typescript
import { readFile } from 'node:fs/promises';

interface EditAssetOptions {
  imagePath: string;
  instruction: string;
  model?: string;
  outputPath: string;
}

async function editAsset({
  imagePath,
  instruction,
  model = 'gemini-2.5-flash-image',
  outputPath,
}: EditAssetOptions): Promise<void> {
  const imageBuffer = await readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/png';

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: instruction },
        ],
      },
    ],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData,
  );

  if (!imagePart?.inlineData) {
    throw new Error('No image returned in response');
  }

  const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
  await writeFile(outputPath, buffer);
  console.log(`Saved edited: ${outputPath}`);
}
```

### Usage

```typescript
// Generate base
await generateAsset({
  prompt: 'pixel art iron sword, 32x32, transparent background, no text',
  outputPath: 'public/assets/items/weapon_sword_iron.png',
  seed: 100,
});

// Refine
await editAsset({
  imagePath: 'public/assets/items/weapon_sword_iron.png',
  instruction: 'Make the blade glow with a blue enchantment effect',
  outputPath: 'public/assets/items/weapon_sword_enchanted.png',
});
```

---

## Reference Image for Style Consistency

Send up to 14 reference images alongside a prompt to maintain visual
consistency across all assets:

```typescript
interface GenerateWithReferenceOptions {
  prompt: string;
  referencePaths: string[];
  model?: string;
  outputPath: string;
  seed?: number;
}

async function generateWithReference({
  prompt,
  referencePaths,
  model = 'gemini-3.1-flash-image-preview',
  outputPath,
  seed,
}: GenerateWithReferenceOptions): Promise<void> {
  const referenceParts = await Promise.all(
    referencePaths.map(async (refPath) => {
      const buffer = await readFile(refPath);
      return {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: 'image/png',
        },
      };
    }),
  );

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          ...referenceParts,
          { text: `Using the same art style as the reference images: ${prompt}` },
        ],
      },
    ],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(seed !== undefined && { seed }),
    },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData,
  );

  if (!imagePart?.inlineData) {
    throw new Error('No image returned in response');
  }

  const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  console.log(`Saved: ${outputPath}`);
}
```

### Usage

```typescript
// Generate all assets matching the style reference
const styleRef = 'public/assets/style_reference.png';

await generateWithReference({
  prompt: 'pixel art mage character sprite, 64x64, transparent background, idle pose',
  referencePaths: [styleRef],
  outputPath: 'public/assets/characters/hero_mage_idle.png',
  seed: 55,
});
```

---

## Seed for Reproducibility

```typescript
// Generate 4 variations with different seeds
async function generateVariations(
  prompt: string,
  basePath: string,
  model = 'gemini-3.1-flash-image-preview',
): Promise<void> {
  const seeds = [42, 123, 456, 789];

  for (const seed of seeds) {
    const outputPath = basePath.replace('.png', `_seed${seed}.png`);
    await generateAsset({ prompt, model, outputPath, seed });
  }

  console.log(`Generated ${seeds.length} variations at ${basePath}`);
}
```

---

## Error Handling

```typescript
async function generateWithRetry(
  options: GenerateAssetOptions,
  maxRetries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await generateAsset(options);
      return;
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };

      // Rate limiting — exponential backoff
      if (err.status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Content safety rejection — cannot retry, must rephrase
      if (err.status === 400 && err.message?.includes('safety')) {
        console.error('Prompt rejected by safety filter. Rephrase the prompt.');
        throw error;
      }

      // Timeout
      if (err.message?.includes('timeout') || err.message?.includes('DEADLINE_EXCEEDED')) {
        console.warn(`Timeout on attempt ${attempt}. Retrying...`);
        continue;
      }

      // Unknown error on last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      console.warn(`Attempt ${attempt} failed: ${err.message}. Retrying...`);
    }
  }
}
```

---

## Batch Generation Script

Generate multiple assets from a JSON manifest:

```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

interface AssetManifestEntry {
  name: string;
  category: string;
  model: string;
  seed: number;
  prompt: string;
}

interface AssetManifest {
  assets: AssetManifestEntry[];
}

async function batchGenerate(manifestPath: string): Promise<void> {
  const raw = await readFile(manifestPath, 'utf-8');
  const manifest: AssetManifest = JSON.parse(raw);

  console.log(`Generating ${manifest.assets.length} assets...`);

  const results: { name: string; status: string }[] = [];

  for (const asset of manifest.assets) {
    const outputPath = `public/assets/${asset.category}/${asset.name}.png`;

    try {
      await generateWithRetry({
        prompt: asset.prompt,
        model: asset.model,
        outputPath,
        seed: asset.seed,
      });
      results.push({ name: asset.name, status: 'success' });
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`Failed: ${asset.name} — ${err.message}`);
      results.push({ name: asset.name, status: `failed: ${err.message}` });
    }

    // Small delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Print summary
  const succeeded = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status !== 'success').length;
  console.log(`\nDone: ${succeeded} succeeded, ${failed} failed`);

  // Save results
  await writeFile(
    manifestPath.replace('.json', '_results.json'),
    JSON.stringify(results, null, 2),
  );
}
```

### Manifest Example

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
    },
    {
      "name": "area_forest_day",
      "category": "backgrounds",
      "model": "gemini-3-pro-image-preview",
      "seed": 456,
      "prompt": "pixel art forest landscape, 16:9 aspect ratio, layered parallax depth, golden hour sunset, atmospheric fog, no characters, tileable edges, no text, no watermark"
    }
  ]
}
```

### Running the Batch Script

```bash
bun run scripts/generate-assets.ts -- assets-manifest.json
```
