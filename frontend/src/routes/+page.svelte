<script lang="ts">
	import { getStoredKeys } from '$lib/storage/keys';
	import { agents } from '$lib/stores/agents.svelte';
	import AgentCard from '$lib/components/AgentCard.svelte';

	let message = $state('');
	let isProcessing = $state(false);
	let response = $state('');
	let error = $state('');

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

<div class="flex min-h-screen flex-col items-center justify-center px-4">
	<!-- Agents Display Section -->
	{#if currentAgents.length > 0}
		<div class="mb-8 w-full max-w-2xl">
			<h2 class="mb-4 text-xl font-semibold text-gray-700">
				Active Agents ({currentAgents.length})
			</h2>
			<div class="space-y-4">
				{#each currentAgents as agent}
					<AgentCard {agent} />
				{/each}
			</div>
		</div>
	{/if}

	<!-- Search Section -->
	<div class="w-full max-w-2xl space-y-4">
		<div class="relative">
			<button
				onclick={() => {
					activeAgent?.makeVoiceActive();
				}}>Join Call</button
			>
			<input
				type="text"
				bind:value={message}
				class="w-full rounded-full border border-gray-300 px-5 py-3 text-lg shadow-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				placeholder="What can we help you with?"
				onkeydown={(e) => e.key === 'Enter' && handleMessage()}
			/>
			<button
				class="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
				onclick={handleMessage}
				disabled={isProcessing}
				aria-label="Search"
			>
				{#if isProcessing}
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-gray-500 border-t-transparent"
					></div>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				{/if}
			</button>
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
