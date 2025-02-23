<script lang="ts">
	import { getStoredKeys } from '$lib/storage/keys';
	import { agents } from '$lib/stores/agents.svelte';
	import { showApiKeysPopup } from '$lib/stores/apiKeys';
	import Logo from '$lib/components/Logo.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import HangUpIcon from '$lib/assets/icons/hangup.svg';
	import MicIcon from '$lib/assets/icons/mic.svg';
	import Agent from '$lib/components/Agent.svelte';
	import ChatTranscript from '$lib/components/ChatTranscript.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import { sessions } from '$lib/stores/agents.svelte';
	import ApiKeyInputs from '$lib/components/ApiKeyInputs.svelte';

	let message = $state('');
	let isProcessing = $state(false);
	let response = $state('');
	let responseAgentName = $state('');
	let error = $state('');
	let isTranscriptExpanded = $state(false);
	let apiKeysNotSet = $state(true);
	let currentAgents = $derived(agents.list);

	let activeAgent = $derived(currentAgents.find((agent) => agent.getState() === 'ACTIVE'));

		// Load keys from localStorage on mount
	$effect(() => {
		const {
			openaiKey: storedOpenAIKey,
			elevenLabsKey: storedElevenLabsKey,
			falKey: storedFalKey
		} = getStoredKeys();
		apiKeysNotSet = !storedOpenAIKey || !storedElevenLabsKey || !storedFalKey;
	});

	async function handleMessage() {
		if (!message.trim()) return;

		response = message;
		responseAgentName = 'User';

		const messageCopy = message.trim();
		message = '';
		//get agent
		const agent = currentAgents.find((agent) => agent.getState() === 'ACTIVE');

		if (!agent) {
			error = 'No active agent found';
			console.error('No active agent found');
			return;
		}

		const { openaiKey } = getStoredKeys();
		if (!openaiKey) {
			error = 'Please enter your OpenAI API key first';
			return;
		}

		isProcessing = true;
		error = '';

		try {
			response = await agent.chat(messageCopy);
			responseAgentName = agent.getName();
		} catch (err) {
			message = '';
			error = 'Failed to process your request';
			console.error(err);
		} finally {
			isProcessing = false;
		}
	}

	function handleCreateSession() {
		sessions.createDefaultSession();
	}

	function handleKeysUpdated(event: CustomEvent<{ keysSet: boolean }>) {
		apiKeysNotSet = !event.detail.keysSet;
	}
</script>

<svelte:head>
	<title>Project WarRoom</title>
	<link
		href="https://fonts.googleapis.com/css2?family=Anonymous+Pro:wght@400;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<ChatTranscript bind:isExpanded={isTranscriptExpanded}  showButton={agents.list.length > 0}/>
<ApiKeyInputs on:keysUpdated={handleKeysUpdated} />

<div class="transition-[padding] duration-300 p-8" class:pr-96={isTranscriptExpanded}>
	<div class="bg-black text-white">

		{#if currentAgents.length === 0}
			<main class="flex min-h-[calc(100vh-200px)] items-center justify-center">
				<div class="flex w-full max-w-3xl flex-col items-center gap-12">
					
					<div class="flex flex-col items-center text-center gap-6">
						<div>
							<h1 class="text-4xl font-bold">Welcome to</h1>
							<Logo size="large" />
						</div>
						<p class="text-lg text-gray-400 max-w-xl">
							Your multi-agent command center for strategic conversations and decision making.
						</p>
					</div>

					{#if apiKeysNotSet}
						<div class="flex flex-col items-center gap-6 bg-gray-900/50 p-8 rounded-lg border border-gray-800">
							<div class="flex flex-col items-center gap-2">
								<h2 class="text-xl font-semibold">Get Started</h2>
								<p class="text-sm text-gray-400">Configure your API keys to begin your first session</p>
							</div>
							<AppButton text="Set API Keys" variant="primary" onClick={() => showApiKeysPopup()} />
						</div>
					{:else}
						<div class="flex flex-col items-center gap-6 bg-green-900/50 p-8 rounded-lg border border-green-800">
							<div class="flex flex-col items-center gap-2">
								<h2 class="text-xl font-semibold">Ready to Begin</h2>
								<p class="text-sm text-gray-400">Start your first session with our AI agents</p>
							</div>
							<AppButton text="Start Session" variant="primary" onClick={handleCreateSession} />
						</div>
					{/if}

				</div>
			</main>
		{:else}
			<!-- Agents Display Section -->
			<div class="pb-40 mx-auto mb-8 w-full max-w-5xl">
				<h2 class="mb-4 text-xl font-semibold">
					Active Agents ({currentAgents.length})
				</h2>
				<div class="grid gap-4" 
					class:grid-cols-1={currentAgents.length === 1}
					class:grid-cols-2={currentAgents.length === 2}
					class:grid-cols-3={currentAgents.length === 3 || currentAgents.length === 4}
					class:grid-cols-4={currentAgents.length > 4}
					style="grid-auto-rows: minmax(300px, 1fr);"
				>
					{#each currentAgents as agent}
						<div class="h-full" class:mx-auto={currentAgents.length === 1} class:max-w-md={currentAgents.length === 1}>
							<Agent {agent} />
						</div>
					{/each}
				</div>
			</div>

			<!-- Search and Controls Section -->
			<div
				class="fixed bottom-4 right-0 p-4 transition-transform duration-300"
				class:-left-96={isTranscriptExpanded}
				class:left-0={!isTranscriptExpanded}
			>
				<div class="mx-auto w-full max-w-2xl items-end justify-center space-y-4">
					{#if response}
						<div class="bg-black border border-white p-4 text-white relative">
							<button 
								class="absolute top-2 right-2 text-white/50 hover:text-white text-sm"
								onclick={() => response = ''}
							>
								dismiss
							</button>
							<h3 class="text-sm text-[#FF6222] mb-1">{responseAgentName}:</h3>
							{response}
						</div>
					{/if}

					{#if error}
						<div class="rounded-md bg-red-50 p-4 text-sm text-red-700">
							{error}
						</div>
					{/if}
					<div class="flex items-center justify-center gap-4">
						<!-- <div class="flex-1">
							<SearchBar
								bind:value={message}
								onSearch={handleMessage}
								placeholder="What can we help you with?"
							/>
						</div> -->
						{#if agents.mode === 'VOICE'}
							{#if activeAgent?.getCallStartTime()}
								<div class="absolute bottom-full">
									<Timer startTime={activeAgent.getCallStartTime()} />
								</div>
							{/if}
							{#if activeAgent?.getIsConnectedToConversation()}
								<AppButton
									text="Hang Up"
									variant="destructive"
									icon={HangUpIcon}
									onClick={() => (agents.mode = 'TEXT')}
								/>
							{:else}
								<AppButton text="Connecting..." variant="primary" icon={MicIcon} disabled={true} />
							{/if}
						{:else}
							<AppButton
								text="Live Chat"
								variant="success"
								icon={MicIcon}
								onClick={() => (agents.mode = 'VOICE')}
							/>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
