<script lang="ts">
	import { getStoredKeys } from '$lib/storage/keys';
	import { agents } from '$lib/stores/agents.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import HangUpIcon from '$lib/assets/icons/hangup.svg';
	import MicIcon from '$lib/assets/icons/mic.svg';
	import Agent from '$lib/components/Agent.svelte';
	import ChatTranscript from '$lib/components/ChatTranscript.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	
	let message = $state('');
	let isProcessing = $state(false);
	let response = $state('');
	let error = $state('');
	let isTranscriptExpanded = $state(false);

	let currentAgents = $derived(agents.list);

	let activeAgent = $derived(
		currentAgents.find(
			(agent) => agent.getState() === 'VOICE_ACTIVE' || agent.getState() === 'TEXT_ACTIVE'
		)
	);

	async function handleMessage() {
		if (!message.trim()) return;

		const messageCopy = message.trim();
		message = '';
		//get agent
		const agent = currentAgents.find(
			(agent) => agent.getState() === 'VOICE_ACTIVE' || agent.getState() === 'TEXT_ACTIVE'
		);

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
		response = '';

		try {
			response = await agent.chat(messageCopy);
		} catch (err) {
			error = 'Failed to process your request';
			console.error(err);
		} finally {
			isProcessing = false;
		}
	}
</script>

<svelte:head>
	<title>Project WarRoom</title>
	<link
		href="https://fonts.googleapis.com/css2?family=Anonymous+Pro:wght@400;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<ChatTranscript bind:isExpanded={isTranscriptExpanded} />

<div class="transition-[padding] duration-300" class:pr-96={isTranscriptExpanded}>
	<div class="min-h-screen bg-black p-8 text-white">
		{#if currentAgents.length === 0}
			<main class="flex min-h-[calc(100vh-200px)] items-center justify-center">
				<div class="flex w-full max-w-3xl flex-col items-center gap-12">
					<Logo size="large" />
					<div class="w-full">
						<SearchBar
							bind:value={message}
							onSearch={handleMessage}
							placeholder="What can we help you with?"
						/>
					</div>
					<AppButton text="Hang Up" variant="destructive" icon={HangUpIcon} />
				</div>
			</main>
		{:else}
			<!-- Agents Display Section -->
			<div class="pb-30 mx-auto mb-8 w-full max-w-4xl">
				<h2 class="mb-4 text-xl font-semibold">
					Active Agents ({currentAgents.length})
				</h2>
				<div class="grid grid-cols-3 gap-4">
					{#each currentAgents as agent}
						<Agent {agent} />
					{/each}
				</div>
			</div>

			<!-- Search and Controls Section -->
			<div
				class="fixed bottom-8 right-0 p-4 transition-transform duration-300"
				class:-left-96={isTranscriptExpanded}
				class:left-0={!isTranscriptExpanded}
			>
				<div class="mx-auto w-full max-w-2xl items-end space-y-4">
					<div class="flex items-end gap-4">
						<div class="flex-1">
							<SearchBar
								bind:value={message}
								onSearch={handleMessage}
								placeholder="What can we help you with?"
							/>
						</div>
						{#if agents.mode === 'VOICE'}
							{#if activeAgent?.getCallStartTime()}
								<div class="absolute bottom-20 right-1/4 -translate-x-1/2">
									<Timer startTime={activeAgent.getCallStartTime()} />
								</div>
							{/if}
							<AppButton
								text="Hang Up"
								variant="destructive"
								icon={HangUpIcon}
								onClick={() => (agents.mode = 'TEXT')}
							/>
						{:else}
							<AppButton
								text="Voice Call"
								variant="success"
								icon={MicIcon}
								onClick={() => (agents.mode = 'VOICE')}
							/>
						{/if}
					</div>

					{#if error}
						<div class="rounded-md bg-red-50 p-4 text-sm text-red-700">
							{error}
						</div>
					{/if}

					{#if response}
						<div class="rounded-md bg-gray-50 p-4 text-gray-700">
							{response}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
