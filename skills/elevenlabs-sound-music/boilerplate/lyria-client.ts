/**
 * Vertex AI Lyria 002 client for game music generation.
 * Outputs 32.8-second WAV at 48 kHz stereo. Instrumental only.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { GoogleAuth } from "google-auth-library";

interface LyriaConfig {
	projectId: string;
	location?: string;
}

interface GenerateOptions {
	prompt: string;
	negativePrompt?: string;
	seed?: number;
	sampleCount?: 1 | 2 | 3 | 4;
}

interface LyriaPrediction {
	bytesBase64Encoded: string;
	mimeType: string;
}

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

interface LyriaResponse {
	predictions: LyriaPrediction[];
}

class LyriaClient {
	private readonly projectId: string;
	private readonly location: string;
	private readonly auth: GoogleAuth;
	private readonly endpoint: string;

	constructor(config: LyriaConfig) {
		this.projectId = config.projectId;
		this.location = config.location ?? "us-central1";
		this.auth = new GoogleAuth({
			scopes: ["https://www.googleapis.com/auth/cloud-platform"],
		});
		this.endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/lyria-002:predict`;
	}

	private async getAccessToken(): Promise<string> {
		const client = await this.auth.getClient();
		const tokenResponse = await client.getAccessToken();
		return tokenResponse.token!;
	}

	/**
	 * Generate music from a text prompt.
	 * Returns 1-4 predictions, each containing base64-encoded WAV data.
	 */
	async generate(options: GenerateOptions): Promise<LyriaPrediction[]> {
		const token = await this.getAccessToken();

		const requestBody: LyriaRequest = {
			instances: [
				{
					prompt: options.prompt,
					...(options.negativePrompt && {
						negative_prompt: options.negativePrompt,
					}),
					...(options.seed !== undefined && { seed: options.seed }),
				},
			],
			parameters: {
				sample_count: options.sampleCount ?? 1,
			},
		};

		const response = await fetch(this.endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Lyria API error (${response.status}): ${error}`);
		}

		const data: LyriaResponse = await response.json();
		return data.predictions;
	}

	/**
	 * Generate with exponential backoff for rate limit handling.
	 */
	async generateWithRetry(
		options: GenerateOptions,
		maxRetries = 3,
	): Promise<LyriaPrediction[]> {
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await this.generate(options);
			} catch (error) {
				if (attempt === maxRetries) throw error;

				const message = error instanceof Error ? error.message : String(error);
				if (!message.includes("429") && !message.includes("503")) throw error;

				const delay = 2 ** attempt * 1000 + Math.random() * 1000;
				console.log(
					`Rate limited. Retrying in ${Math.round(delay / 1000)}s...`,
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		throw new Error("Unreachable");
	}

	/**
	 * Save a single prediction to disk as WAV.
	 */
	async save(prediction: LyriaPrediction, outputPath: string): Promise<void> {
		const buffer = Buffer.from(prediction.bytesBase64Encoded, "base64");
		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(outputPath, buffer);
	}

	/**
	 * Save all predictions as numbered variations.
	 * Returns array of saved file paths.
	 */
	async saveAll(
		predictions: LyriaPrediction[],
		baseName: string,
		outputDir: string,
	): Promise<string[]> {
		const paths: string[] = [];

		for (let i = 0; i < predictions.length; i++) {
			const filename = `${baseName}_v${i + 1}.wav`;
			const outputPath = join(outputDir, filename);
			await this.save(predictions[i], outputPath);
			paths.push(outputPath);
		}

		return paths;
	}
}

export { LyriaClient };
export type {
	LyriaConfig,
	GenerateOptions,
	LyriaPrediction,
	LyriaRequest,
	LyriaResponse,
};
