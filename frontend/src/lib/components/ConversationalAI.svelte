<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Conversation } from '@11labs/client';
	import { getStoredKeys } from '$lib/storage/keys';
	import type { Agent } from '$lib/utils/agent.svelte';

	let isRecording = $state(false);
	let error = $state<string | null>(null);
	let transcription = $state('');
	let conversation = $state<Conversation | null>(null);
	let volume = $state(0.8);

	let {
		agent = $bindable()
	}: {
		agent: Agent;
	} = $props();

	onMount(async () => {
		const { elevenLabsKey } = getStoredKeys();
		if (!elevenLabsKey) {
			error = 'Please enter your ElevenLabs API key first';
			return;
		}

		try {
			// Request microphone access first
			await navigator.mediaDevices.getUserMedia({ audio: true });

			const agentId = agent.getElevenLabsAgentId();
			if (!agentId) {
				error = 'No agent ID found';
				return;
			}

			// Initialize conversation
			conversation = await Conversation.startSession({
				agentId: agentId,

				onMessage: (message: { message: string; source: string }) => {
					transcription = message.message;
				},
				onError: (err) => {
					console.error('Conversation error:', err);
					error = 'Error in conversation';
				},
				onStatusChange: (status) => {
					console.log('Connection status:', status);
				},
				onModeChange: (mode: { mode: 'listening' | 'speaking' | 'idle' }) => {
					console.log('Mode changed:', mode);
					isRecording = mode.mode === 'listening';
				},
				clientTools: {
					get_persona: async (args) => {
						return "You're an expert on rifles. Tell the user about the best rifles in the world whenever he asks for more information,";
					}
				}
			});

			// Set initial volume
			await conversation.setVolume({ volume: volume });

			error = null;
		} catch (err) {
			error = 'Failed to initialize conversation';
			console.error('Error initializing conversation:', err);
		}
	});

	// Start recording
	async function startRecording() {
		if (!conversation) return;
		try {
			isRecording = true;
			// The conversation will automatically start listening
		} catch (err) {
			console.error('Error starting recording:', err);
			error = 'Failed to start recording';
		}
	}

	// Stop recording
	async function stopRecording() {
		if (!conversation) return;
		try {
			isRecording = false;
			// The conversation will automatically stop listening
		} catch (err) {
			console.error('Error stopping recording:', err);
			error = 'Failed to stop recording';
		}
	}

	// Clean up resources when component is destroyed
	onDestroy(() => {
		if (conversation) {
			conversation.endSession();
		}
	});
</script>

<div class="conversational-ai">
	{#if error}
		<div class="error">
			{error}
		</div>
	{/if}

	<div class="controls">
		{#if !isRecording}
			<button
				onclick={startRecording}
				disabled={!conversation || error ? true : undefined}
				class="start-btn"
			>
				Start Recording
			</button>
		{:else}
			<button onclick={stopRecording} class="stop-btn"> Stop Recording </button>
		{/if}
	</div>

	{#if transcription}
		<div class="transcription">
			<h3>Transcription:</h3>
			<p>{transcription}</p>
		</div>
	{/if}
</div>

<style>
	.conversational-ai {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.error {
		color: #ff3e3e;
		background-color: #fff1f1;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid #ffd1d1;
	}

	.controls {
		display: flex;
		justify-content: center;
		gap: 1rem;
	}

	button {
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		border: none;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.start-btn {
		background-color: #4caf50;
		color: white;
	}

	.start-btn:hover:not(:disabled) {
		background-color: #45a049;
	}

	.stop-btn {
		background-color: #f44336;
		color: white;
	}

	.stop-btn:hover {
		background-color: #da190b;
	}

	.transcription {
		background-color: #f5f5f5;
		padding: 1rem;
		border-radius: 0.5rem;
		margin-top: 1rem;
	}

	.transcription h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.1rem;
		color: #333;
	}

	.transcription p {
		margin: 0;
		color: #666;
		line-height: 1.5;
	}
</style>
