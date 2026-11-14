// Verified against: @elevenlabs/elevenlabs-js 2.78.0 (2026-11-14)
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ElevenLabs, ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// Offline asset generation: voice lines, sound effects and music for a game.
// Build the client once with `new ElevenLabsClient()`; it reads
// ELEVENLABS_API_KEY from the environment. Run this from a build script or a
// server, never from the game client, so the key stays private.
//
// Model ids are set on every call. Two endpoints default to deprecated models
// when model_id is omitted: sound effects (eleven_text_to_sound_v2, removed
// 2027-03-01) and music (music_v1, removed 2027-01-31).

export const SFX_MODEL = "eleven_text_to_sound_v3" satisfies ElevenLabs.SfxModelId;
export const MUSIC_MODEL = "music_v2_5" satisfies ElevenLabs.MusicModelId;

// Text to Speech models. `quality` for pre-recorded dialogue, `fast` for lines
// generated while the player waits.
export const TTS_MODEL = {
	quality: "eleven_multilingual_v2",
	fast: "eleven_flash_v2_5",
} as const;

const readAll = async (stream: ReadableStream<Uint8Array>) =>
	new Uint8Array(await new Response(stream).arrayBuffer());

export interface VoiceLineRequest {
	text: string;
	// One voice id per character. Keep the mapping in config so a character
	// never changes voice between sessions.
	voiceId: string;
	modelId?: (typeof TTS_MODEL)[keyof typeof TTS_MODEL];
	outputFormat?: ElevenLabs.TextToSpeechConvertRequestOutputFormat;
	// Best effort only: the API does not guarantee identical audio for a seed.
	seed?: number;
}

export const generateVoiceLine = async (
	client: ElevenLabsClient,
	{ text, voiceId, modelId = TTS_MODEL.quality, outputFormat, seed }: VoiceLineRequest,
) =>
	readAll(
		await client.textToSpeech.convert(voiceId, {
			text,
			modelId,
			outputFormat,
			seed,
		}),
	);

export interface SfxRequest {
	text: string;
	// 0.5 to 30 seconds. Omit to let the model pick the length.
	durationSeconds?: number;
	// true for ambience that must repeat without an audible seam.
	loop?: boolean;
	// 0 to 1, default 0.3. Higher follows the prompt more literally.
	promptInfluence?: number;
	outputFormat?: ElevenLabs.TextToSoundEffectsConvertRequestOutputFormat;
}

export const generateSfx = async (client: ElevenLabsClient, request: SfxRequest) =>
	readAll(
		await client.textToSoundEffects.convert({ ...request, modelId: SFX_MODEL }),
	);

export interface MusicRequest {
	prompt: string;
	// 3,000 to 600,000 ms. Omit to let the model pick the length.
	musicLengthMs?: number;
	// Game underscore is instrumental by default. Set false for a vocal song.
	forceInstrumental?: boolean;
	outputFormat?: ElevenLabs.MusicComposeRequestOutputFormat;
}

// Prompt mode. `seed` is not accepted here: the API allows it only with a
// composition plan.
export const composeMusic = async (
	client: ElevenLabsClient,
	{ prompt, musicLengthMs, forceInstrumental = true, outputFormat }: MusicRequest,
) =>
	readAll(
		await client.music.compose({
			prompt,
			musicLengthMs,
			forceInstrumental,
			outputFormat,
			modelId: MUSIC_MODEL,
		}),
	);

export type MusicPlan = ElevenLabs.BodyComposeMusicV1MusicPostCompositionPlan;

// Returns a plan to inspect or edit (section lengths, styles) before rendering.
export const createMusicPlan = (
	client: ElevenLabsClient,
	prompt: string,
	musicLengthMs?: number,
): Promise<MusicPlan> =>
	client.music.compositionPlan.create({
		prompt,
		musicLengthMs,
		modelId: MUSIC_MODEL,
	});

// Plan mode. Use the same plan and seed to regenerate a close variant later;
// the API says reproducibility is not guaranteed across system updates.
export const composeFromPlan = async (
	client: ElevenLabsClient,
	plan: MusicPlan,
	seed?: number,
	outputFormat?: ElevenLabs.MusicComposeRequestOutputFormat,
) =>
	readAll(
		await client.music.compose({
			compositionPlan: plan,
			seed,
			outputFormat,
			modelId: MUSIC_MODEL,
		}),
	);

export const saveAudio = async (path: string, bytes: Uint8Array) => {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, bytes);
};
