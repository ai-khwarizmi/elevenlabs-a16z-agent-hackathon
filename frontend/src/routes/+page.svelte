<script lang="ts">
	import { getStoredKeys } from '$lib/storage/keys';
	import { agents } from '$lib/stores/agents.svelte';
	import AgentCard from '$lib/components/AgentCard.svelte';
	import Timer from '$lib/components/Timer.svelte';

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
		<div class="mb-4 flex justify-center gap-4">
			{#if agents.mode === 'VOICE'}
				<div class="flex items-center gap-2 rounded-full bg-gray-100 pl-4">
					{#if activeAgent?.getCallStartTime()}
						<Timer startTime={activeAgent.getCallStartTime()} />
					{/if}
					<button
						class={`rounded-full px-4 py-2 ${'bg-red-500 text-white'}`}
						onclick={() => (agents.mode = 'TEXT')}
					>
						<span class="flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"
								/>
								<path
									d="M16.707 3.293a1 1 0 010 1.414L15.414 6l1.293 1.293a1 1 0 01-1.414 1.414L14 7.414l-1.293 1.293a1 1 0 11-1.414-1.414L12.586 6l-1.293-1.293a1 1 0 011.414-1.414L14 4.586l1.293-1.293a1 1 0 011.414 0z"
								/>
							</svg>
							Hang Up
						</span>
					</button>
				</div>
			{:else}
				<button
					class={`rounded-full px-4 py-2 ${'bg-green-500 text-white'}`}
					onclick={() => (agents.mode = 'VOICE')}
				>
					<span class="flex items-center gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"
							/>
						</svg>
						Voice Call
					</span>
				</button>
			{/if}
		</div>
		<div class="relative">
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
