import type { Agent } from '$lib/utils/agent.svelte';
import type { Tool } from '$lib/utils/tool.svelte';
import { ElevenLabsClient } from 'elevenlabs';

export async function createOrPickRandomVoice(
	name: string,
	description: string,
	apiKey: string
): Promise<string> {
	const client = new ElevenLabsClient({
		apiKey
	});

	const existingVoices = await client.voices.getAll();
	console.log('Existing voices:', existingVoices);

	// if mroe than 10, pick a random one
	if (existingVoices.voices.length > 10) {
		const randomVoice =
			existingVoices.voices[Math.floor(Math.random() * existingVoices.voices.length)];
		return randomVoice.voice_id;
	}

	// if less than 10, create a new one
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
			voice_description: description.slice(0, 500), // TODO: better handling of description limitations
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

function makeToolsArray(tools: Tool[]): {
	type: 'client';
	name: string;
	description: string;
	expects_response: boolean;
	parameters?: Record<string, unknown>;
}[] {
	const toolsArray: {
		type: 'client';
		name: string;
		description: string;
		expects_response: boolean;
		parameters?: Record<string, unknown>;
		response_timeout_secs: number;
	}[] = [
		{
			type: 'client',
			name: 'get_persona',
			description: "Get the agent's personality description",
			expects_response: true,
			response_timeout_secs: 30
		}
	];
	for (const tool of tools) {
		toolsArray.push({
			type: 'client',
			name: tool.getDefinition().function.name,
			description: tool.getDefinition().function.description ?? tool.getDefinition().function.name,
			expects_response: true,
			parameters: tool.getDefinition().function.parameters,
			response_timeout_secs: 30
		});
	}
	return toolsArray;
}

export async function createAgent(
	voice_id: string,
	tools: Tool[],
	options: { apiKey: string; agent: Agent }
): Promise<string> {
	try {
		const toolsArray = makeToolsArray(tools);
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
							prompt: options.agent.getSystemPrompt(),
							tools: toolsArray
						}
					},
					tts: {
						voice_id: voice_id
					},
					conversation: {
						client_events: [
							'audio',
							'interruption',
							'agent_response',
							'client_tool_call',
							'user_transcript'
						]
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

export async function updateAgentTools(options: {
	apiKey: string;
	agentId: string;
	agent: Agent;
	tools?: Tool[];
}): Promise<void> {
	try {
		const toolsArray = makeToolsArray(options.tools ?? []);

		const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${options.agentId}`, {
			method: 'PATCH',
			headers: {
				'xi-api-key': options.apiKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				conversation_config: {
					agent: {
						prompt: {
							prompt: options.agent.getSystemPrompt(),
							tools: toolsArray,
							llm: 'gpt-4o'
						}
					},
					conversation: {
						client_events: [
							'audio',
							'interruption',
							'agent_response',
							'client_tool_call',
							'user_transcript'
						]
					}
				}
			})
		});

		const result = await response.json();

		console.log('Agent update result:', result);

		if (!result.agent_id) {
			throw new Error('No agent ID returned from API');
		}
	} catch (error) {
		console.error('Failed to update agent:', error);
		throw error;
	}
}
