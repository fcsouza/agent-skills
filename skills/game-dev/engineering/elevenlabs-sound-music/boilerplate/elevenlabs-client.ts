/**
 * ElevenLabs API client for game audio: voice lines, SFX, and voice cloning.
 */

interface TextToSpeechOptions {
	voiceId: string;
	model?:
		| "eleven_multilingual_v2"
		| "eleven_turbo_v2_5"
		| "eleven_monolingual_v1";
	stability?: number;
	similarityBoost?: number;
	style?: number;
	outputFormat?:
		| "mp3_44100_128"
		| "mp3_44100_192"
		| "pcm_16000"
		| "pcm_22050"
		| "pcm_24000"
		| "pcm_44100"
		| "ulaw_8000";
}

interface SfxOptions {
	duration?: number;
	promptInfluence?: number;
}

interface VoiceCloneOptions {
	name: string;
	description?: string;
	labels?: Record<string, string>;
}

interface Voice {
	voice_id: string;
	name: string;
	category: string;
	labels: Record<string, string>;
}

class ElevenLabsClient {
	private readonly baseUrl = "https://api.elevenlabs.io/v1";
	private readonly apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	private headers(contentType = "application/json"): Record<string, string> {
		return {
			"xi-api-key": this.apiKey,
			"Content-Type": contentType,
		};
	}

	/**
	 * Generate speech from text for character dialogue and narration.
	 * Returns raw audio bytes (MP3 by default).
	 */
	async textToSpeech(
		text: string,
		options: TextToSpeechOptions,
	): Promise<ArrayBuffer> {
		const {
			voiceId,
			model = "eleven_multilingual_v2",
			stability = 0.5,
			similarityBoost = 0.75,
			style = 0,
			outputFormat = "mp3_44100_128",
		} = options;

		const response = await fetch(
			`${this.baseUrl}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
			{
				method: "POST",
				headers: this.headers(),
				body: JSON.stringify({
					text,
					model_id: model,
					voice_settings: {
						stability,
						similarity_boost: similarityBoost,
						style,
						use_speaker_boost: true,
					},
				}),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`ElevenLabs TTS error (${response.status}): ${error}`);
		}

		return response.arrayBuffer();
	}

	/**
	 * Generate a sound effect from a text description.
	 * Great for UI sounds, combat impacts, ambient one-shots, notifications.
	 */
	async generateSfx(
		text: string,
		options: SfxOptions = {},
	): Promise<ArrayBuffer> {
		const { duration, promptInfluence = 0.3 } = options;

		const body: Record<string, unknown> = {
			text,
			prompt_influence: promptInfluence,
		};

		if (duration !== undefined) {
			body.duration_seconds = duration;
		}

		const response = await fetch(`${this.baseUrl}/sound-generation`, {
			method: "POST",
			headers: this.headers(),
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`ElevenLabs SFX error (${response.status}): ${error}`);
		}

		return response.arrayBuffer();
	}

	/**
	 * Clone a voice from audio samples for consistent character voices.
	 * Upload 1-25 audio samples of the target voice.
	 */
	async cloneVoice(
		samples: File[],
		options: VoiceCloneOptions,
	): Promise<Voice> {
		const formData = new FormData();
		formData.append("name", options.name);

		if (options.description) {
			formData.append("description", options.description);
		}

		if (options.labels) {
			formData.append("labels", JSON.stringify(options.labels));
		}

		for (const sample of samples) {
			formData.append("files", sample);
		}

		const response = await fetch(`${this.baseUrl}/voices/add`, {
			method: "POST",
			headers: { "xi-api-key": this.apiKey },
			body: formData,
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`ElevenLabs clone error (${response.status}): ${error}`);
		}

		return response.json();
	}

	/**
	 * List all available voices (library + cloned).
	 */
	async listVoices(): Promise<Voice[]> {
		const response = await fetch(`${this.baseUrl}/voices`, {
			headers: this.headers(),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`ElevenLabs voices error (${response.status}): ${error}`);
		}

		const data = await response.json();
		return data.voices;
	}

	/**
	 * Save audio buffer to disk using Bun's file API.
	 */
	async save(buffer: ArrayBuffer, outputPath: string): Promise<void> {
		await Bun.write(outputPath, buffer);
	}
}

export { ElevenLabsClient };
export type { TextToSpeechOptions, SfxOptions, VoiceCloneOptions, Voice };
