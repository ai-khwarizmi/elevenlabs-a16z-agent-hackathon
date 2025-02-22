<script lang="ts">
	import ApiKeyInputs from '$lib/components/ApiKeyInputs.svelte';
	import { createHelperAgent } from '$lib/api/agents/helper';
	import { getStoredKeys } from '$lib/storage/keys';
	import { agents } from '$lib/stores/agents.svelte';

	let searchQuery = $state('');
	let isProcessing = $state(false);
	let response = $state('');
	let error = $state('');
	let helperAgent = $state<ReturnType<typeof createHelperAgent> | null>(null);

	let currentAgents = $derived(agents.list);

	// Initialize helper agent when OpenAI API key is available
	$effect(() => {
		const { openaiKey } = getStoredKeys();
		if (openaiKey && !helperAgent) {
			try {
				helperAgent = createHelperAgent();
			} catch (err) {
				error = 'Failed to initialize helper agent';
				console.error(err);
			}
		}
	});

	async function handleSearch() {
		if (!searchQuery.trim()) return;
		if (!helperAgent) {
			error = 'Please enter your OpenAI API key first';
			return;
		}

		isProcessing = true;
		error = '';
		response = '';

		try {
			response = await helperAgent.chat(searchQuery);
		} catch (err) {
			error = 'Failed to process your request';
			console.error(err);
		} finally {
			isProcessing = false;
		}
	}
</script>

<ApiKeyInputs />

<div class="flex min-h-screen flex-col items-center justify-center px-4">
	<!-- Agents Display Section -->
	{#if currentAgents.length > 0}
		<div class="mb-8 w-full max-w-2xl">
			<h2 class="mb-4 text-xl font-semibold text-gray-700">
				Active Agents ({currentAgents.length})
			</h2>
			<div class="space-y-4">
				{#each currentAgents as agent}
					<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
						<div class="flex items-center justify-between">
							<h3 class="text-lg font-medium text-gray-900">{agent.getName()}</h3>
							<span class="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
								{agent.isAgentActive() ? 'Active' : 'Standby'}
							</span>
						</div>
						<p class="mt-2 text-sm text-gray-600">{agent.getPersonality()}</p>
						{#if agent.getTools().length > 0}
							<div class="mt-3">
								<p class="text-sm font-medium text-gray-700">Tools:</p>
								<div class="mt-1 flex flex-wrap gap-2">
									{#each agent.getTools() as tool}
										<span
											class="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
										>
											{tool.getDefinition().function.name}
										</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Search Section -->
	<div class="w-full max-w-2xl space-y-4">
		<div class="relative">
			<input
				type="text"
				bind:value={searchQuery}
				class="w-full rounded-full border border-gray-300 px-5 py-3 text-lg shadow-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				placeholder="What can we help you with?"
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<button
				class="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
				onclick={handleSearch}
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
