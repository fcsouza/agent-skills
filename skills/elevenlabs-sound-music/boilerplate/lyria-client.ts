// Verified against: @google-cloud/aiplatform 7.8.0 (2026-11-14)
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PredictionServiceClient, type protos } from "@google-cloud/aiplatform";

// Lyria 2 (`lyria-002`, GA) through the Vertex AI predict method.
// Instrumental only, WAV at 48 kHz, prompts in US English, up to 4 clips per
// prompt. The client authenticates with Application Default Credentials; on
// a workstation, run `gcloud auth application-default login` once.

export const LYRIA_MODEL = "lyria-002";

export interface LyriaTarget {
	projectId: string;
	// The API reference sample uses us-central1.
	location?: string;
}

// `seed` and `sampleCount` cannot be sent in the same request.
export type LyriaRequest = {
	prompt: string;
	// What to leave out, e.g. "drums, electric guitar". Not "no drums".
	negativePrompt?: string;
} & (
	| { seed: number; sampleCount?: never }
	| { sampleCount?: 1 | 2 | 3 | 4; seed?: never }
);

type Value = protos.google.protobuf.IValue;

export const createLyriaClient = ({ location = "us-central1" }: LyriaTarget) =>
	new PredictionServiceClient({
		apiEndpoint: `${location}-aiplatform.googleapis.com`,
	});

// Returns one WAV file per clip.
export const generateMusic = async (
	client: PredictionServiceClient,
	{ projectId, location = "us-central1" }: LyriaTarget,
	request: LyriaRequest,
): Promise<Buffer[]> => {
	const instance: Record<string, Value> = {
		prompt: { stringValue: request.prompt },
	};
	if (request.negativePrompt) {
		instance.negative_prompt = { stringValue: request.negativePrompt };
	}
	if (request.seed !== undefined) {
		instance.seed = { numberValue: request.seed };
	}
	const parameters: Record<string, Value> = {};
	if (request.sampleCount !== undefined) {
		parameters.sample_count = { numberValue: request.sampleCount };
	}

	const [response] = await client.predict({
		endpoint: `projects/${projectId}/locations/${location}/publishers/google/models/${LYRIA_MODEL}`,
		instances: [{ structValue: { fields: instance } }],
		parameters: { structValue: { fields: parameters } },
	});

	// Google's docs disagree on the field name: the API reference returns
	// `audioContent`, the official Lyria 2 notebook decodes `bytesBase64Encoded`.
	return (response.predictions ?? []).map((prediction: Value) => {
		const fields = prediction.structValue?.fields;
		const audio =
			fields?.audioContent?.stringValue ??
			fields?.bytesBase64Encoded?.stringValue;
		if (!audio) throw new Error("Lyria prediction has no audio data");
		return Buffer.from(audio, "base64");
	});
};

// Writes <baseName>_v1.wav, <baseName>_v2.wav, ... and returns the paths.
// Record the prompt, negative prompt and seed next to each file, or the
// track cannot be regenerated.
export const saveClips = async (
	clips: Buffer[],
	baseName: string,
	outputDir: string,
) => {
	const paths = clips.map((_, i) => join(outputDir, `${baseName}_v${i + 1}.wav`));
	await mkdir(outputDir, { recursive: true });
	await Promise.all(clips.map((clip, i) => writeFile(paths[i], clip)));
	return paths;
};
