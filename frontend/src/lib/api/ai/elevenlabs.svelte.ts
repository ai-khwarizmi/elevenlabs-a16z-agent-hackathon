import { ElevenLabsClient } from 'elevenlabs';

export async function createVoice(
	name: string,
	description: string,
	apiKey: string
): Promise<string> {
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

		const voice = await client.textToVoice.createVoiceFromPreview({
			generated_voice_id: result.previews[0].generated_voice_id,
			voice_description: description,
			voice_name: name
		});

		console.log('Voice created:', voice);

		// Return the first generated voice ID
		return voice.voice_id;
	} catch (error) {
		console.error('Failed to create voice:', error);
		throw error;
	}
}

export async function createAgent(
	description: string,
	voice_id: string,
	options: { apiKey: string }
): Promise<string> {
	try {
		const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
			method: 'POST',
			headers: {
				'xi-api-key': options.apiKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				conversation_config: {
					agent: {
						prompt: {
							system: description
						}
					},
					tools: [
						{
							type: 'client',
							name: 'get_persona',
							description: "Get the agent's personality description",
							expects_response: true
						},
						{
							type: 'client',
							name: 'get_chatlog',
							description: 'Get the conversation history',
							expects_response: true
						}
					],
					tts: {
						voice_id: voice_id
					}
				}
			})
		});

		const result = await response.json();

		console.log('Agent creation result:', result);

		if (!result.agent_id) {
			throw new Error('No agent ID returned from API');
		}

		return result.agent_id;
	} catch (error) {
		console.error('Failed to create agent:', error);
		throw error;
	}
}
