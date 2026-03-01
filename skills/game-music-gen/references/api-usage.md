# Vertex AI Lyria API Usage — TypeScript

Complete reference for generating game music with Lyria 002 via the Vertex AI REST API.

## Setup

```typescript
import { GoogleAuth } from 'google-auth-library';

const projectId = process.env.GCP_PROJECT_ID!;
const location = process.env.GCP_LOCATION ?? 'us-central1';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
```

## Authentication

### Service Account (CI / Production)

Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the path of your service account key file:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### Application Default Credentials (Local Dev)

```bash
gcloud auth application-default login
```

### Workload Identity (GKE / Cloud Run)

No configuration needed — the SDK picks up credentials automatically from the metadata server.

### Getting an Access Token

```typescript
const getAccessToken = async (): Promise<string> => {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token!;
};
```

## Direct REST API Call

Lyria 002 uses the Vertex AI prediction endpoint directly:

```typescript
const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/lyria-002:predict`;

interface LyriaRequest {
  instances: {
    prompt: string;
    negative_prompt?: string;
    seed?: number;
  }[];
  parameters: {
    sample_count: number;
  };
}

interface LyriaPrediction {
  bytesBase64Encoded: string;
  mimeType: string;
}

interface LyriaResponse {
  predictions: LyriaPrediction[];
}
```

### Complete Generation Function

```typescript
const generateMusic = async (
  prompt: string,
  options: {
    negativePrompt?: string;
    seed?: number;
    sampleCount?: number;
  } = {},
): Promise<LyriaPrediction[]> => {
  const token = await getAccessToken();

  const requestBody: LyriaRequest = {
    instances: [{
      prompt,
      ...(options.negativePrompt && { negative_prompt: options.negativePrompt }),
      ...(options.seed !== undefined && { seed: options.seed }),
    }],
    parameters: {
      sample_count: options.sampleCount ?? 1,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Lyria API error (${response.status}): ${error}`);
  }

  const data: LyriaResponse = await response.json();
  return data.predictions;
};
```

## Response Handling

### Saving Generated Audio

```typescript
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const saveTrack = async (
  prediction: LyriaPrediction,
  outputPath: string,
): Promise<void> => {
  const buffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
  const dir = join(outputPath, '..');
  await mkdir(dir, { recursive: true });
  await writeFile(outputPath, buffer);
};
```

### Saving All Variations

```typescript
const saveAllVariations = async (
  predictions: LyriaPrediction[],
  baseName: string,
  outputDir: string,
): Promise<string[]> => {
  const paths: string[] = [];

  for (let i = 0; i < predictions.length; i++) {
    const filename = `${baseName}_v${i + 1}.wav`;
    const outputPath = join(outputDir, filename);
    await saveTrack(predictions[i], outputPath);
    paths.push(outputPath);
  }

  return paths;
};
```

## Generating Multiple Variations

Use `sample_count` (1–4) to get multiple musical interpretations of the same prompt:

```typescript
const predictions = await generateMusic(
  'Epic orchestral battle theme, 150 BPM, brass and strings, intense and driving',
  {
    negativePrompt: 'no vocals, no calm sections, no silence',
    seed: 42,
    sampleCount: 4,
  },
);

const paths = await saveAllVariations(predictions, 'combat_theme', './output/music');
// Outputs: combat_theme_v1.wav, combat_theme_v2.wav, combat_theme_v3.wav, combat_theme_v4.wav
```

Each variation interprets the prompt differently. Save all, listen, and pick the best. Record the winning variation's index and seed for future use.

## Complete Game Music Generator

```typescript
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GoogleAuth } from 'google-auth-library';

interface TrackConfig {
  id: string;
  context: string;
  prompt: string;
  negativePrompt: string;
  seed?: number;
  sampleCount?: number;
}

interface GeneratedTrack {
  config: TrackConfig;
  paths: string[];
}

const generateGameTrack = async (
  config: TrackConfig,
  outputDir: string,
): Promise<GeneratedTrack> => {
  console.log(`Generating: ${config.id}...`);

  const predictions = await generateMusic(config.prompt, {
    negativePrompt: config.negativePrompt,
    seed: config.seed,
    sampleCount: config.sampleCount ?? 2,
  });

  const paths = await saveAllVariations(
    predictions,
    config.id,
    join(outputDir, config.context),
  );

  console.log(`Saved ${paths.length} variations for ${config.id}`);
  return { config, paths };
};

// Example: generate a full game soundtrack
const GAME_TRACKS: TrackConfig[] = [
  {
    id: 'menu_orchestral',
    context: 'menu',
    prompt: 'Orchestral fantasy theme, majestic and inviting, 90 BPM, strings lead with gentle brass, harp arpeggios, warm and welcoming atmosphere, suitable for a game main menu',
    negativePrompt: 'no vocals, no sound effects, no sudden changes, no dissonance',
    seed: 1001,
    sampleCount: 2,
  },
  {
    id: 'combat_standard',
    context: 'combat',
    prompt: 'Intense battle music, driving and urgent, 150 BPM, electric guitar riffs, pounding drums, brass stabs, RPG combat theme',
    negativePrompt: 'no vocals, no calm sections, no silence, no sound effects',
    seed: 2001,
    sampleCount: 3,
  },
  {
    id: 'explore_forest',
    context: 'exploration',
    prompt: 'Medieval fantasy exploration music, adventurous and curious, 100 BPM, acoustic guitar lead, flute melody, light percussion, open world feeling',
    negativePrompt: 'no vocals, no sound effects, no sudden loud moments, no silence',
    seed: 3001,
    sampleCount: 2,
  },
];

const generateSoundtrack = async (outputDir: string): Promise<void> => {
  const results: GeneratedTrack[] = [];

  for (const track of GAME_TRACKS) {
    const result = await generateGameTrack(track, outputDir);
    results.push(result);

    // Respect rate limits — wait between requests
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Save generation manifest
  const manifest = results.map(({ config, paths }) => ({
    id: config.id,
    context: config.context,
    seed: config.seed,
    variations: paths,
  }));

  await writeFile(
    join(outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  console.log(`Generated ${results.length} tracks. Manifest saved.`);
};
```

## Rate Limits & Quotas

| Aspect | Value |
|--------|-------|
| Default rate | ~10 requests/min |
| Generation time | 10–20s per request |
| Max variations | 4 per request |
| Output duration | 32.8 seconds |
| Output format | WAV, 48 kHz, stereo |

### Exponential Backoff

```typescript
const generateWithRetry = async (
  prompt: string,
  options: { negativePrompt?: string; seed?: number; sampleCount?: number },
  maxRetries = 3,
): Promise<LyriaPrediction[]> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateMusic(prompt, options);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('429') && !message.includes('503')) throw error;

      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.log(`Rate limited. Retrying in ${Math.round(delay / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable');
};
```

## Cost Optimization

- Generate 2 variations instead of 4 — pick early, refine later
- Reuse seeds: once you find a good seed, tweak prompts instead of generating from scratch
- Batch generation: generate all tracks in one session to minimize overhead
- Budget estimate: ~50 tracks (2 variations each = 100 requests) is moderate cost — check [Vertex AI pricing](https://cloud.google.com/vertex-ai/pricing) for current rates
