import { ElevenLabsClient } from 'elevenlabs';

export async function createVoice(description: string, apiKey: string): Promise<string> {
	const client = new ElevenLabsClient({
		apiKey
	});

	try {
		const text =
			'Every act of kindness, no matter how small, carries value and can make a difference, as no gesture of goodwill is ever wasted.';

		// Create voice previews
		const result = await client.textToVoice.createPreviews({
			voice_description: description,
			text
		});

		console.log('Voice preview results:', {
			numberOfPreviews: result.previews?.length || 0,
			previews: result.previews?.map((preview) => ({
				voiceId: preview.generated_voice_id,
				duration: preview.duration_secs,
				mediaType: preview.media_type
			})),
			text: result.text
		});

		if (!result.previews || result.previews.length === 0) {
			throw new Error('No voice previews generated');
		}

		// Return the first generated voice ID
		return result.previews[0].generated_voice_id;
	} catch (error) {
		console.error('Failed to create voice:', error);
		throw error;
	}
}
