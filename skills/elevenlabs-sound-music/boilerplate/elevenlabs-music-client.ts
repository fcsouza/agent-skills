/**
 * ElevenLabs Music API client for game soundtrack generation.
 * Wraps @elevenlabs/elevenlabs-js — handles compose, plan-based compose, and saving.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

interface CompositionPlan {
	prompt?: string;
	musicLengthMs?: number;
	positiveGlobalStyles?: string[];
	negativeGlobalStyles?: string[];
	[key: string]: unknown;
}

class ElevenLabsMusicClient {
	private readonly client: ElevenLabsClient;

	constructor(apiKey: string) {
		this.client = new ElevenLabsClient({ apiKey });
	}

	/**
	 * Generate music from a text prompt and save to a file.
	 * Output format is determined by the file extension (.mp3 recommended).
	 */
	async compose(
		prompt: string,
		durationMs: number,
		outputPath: string,
	): Promise<void> {
		const audio = await this.client.music.compose({
			prompt,
			musicLengthMs: durationMs,
		});

		await this.save(audio, outputPath);
	}

	/**
	 * Compose music from a pre-generated composition plan.
	 * Useful for inspecting or modifying the plan before rendering.
	 */
	async composeFromPlan(
		plan: object,
		durationMs: number,
		outputPath: string,
	): Promise<void> {
		const audio = await this.client.music.compose({
			compositionPlan: plan as CompositionPlan,
			musicLengthMs: durationMs,
		});

		await this.save(audio, outputPath);
	}

	/**
	 * Generate a composition plan from a prompt without rendering audio.
	 * Inspect plan.positiveGlobalStyles etc. before passing to composeFromPlan.
	 */
	async createCompositionPlan(
		prompt: string,
		durationMs: number,
	): Promise<object> {
		const plan = await this.client.music.compositionPlan.create({
			prompt,
			musicLengthMs: durationMs,
		});

		return plan as object;
	}

	private async save(
		audioStream: AsyncIterable<Uint8Array>,
		outputPath: string,
	): Promise<void> {
		const chunks: Uint8Array[] = [];
		for await (const chunk of audioStream) {
			chunks.push(chunk);
		}

		// Concatenate all chunks into a single Uint8Array
		const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
		const result = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}

		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(outputPath, result);
	}
}

export { ElevenLabsMusicClient };
export type { CompositionPlan };

// Usage:
// const client = new ElevenLabsMusicClient(process.env.ELEVENLABS_API_KEY!);
// await client.compose('Intense battle music, 150 BPM, instrumental only', 60000, 'public/audio/music/combat.mp3');
