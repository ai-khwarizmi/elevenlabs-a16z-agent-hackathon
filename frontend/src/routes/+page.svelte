<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte';
	import { getStoredKeys } from '$lib/storage/keys';
	import { agents } from '$lib/stores/agents.svelte';
	import { Agent } from '$lib/utils/agent.svelte';

	let searchQuery = $state('');
	let isProcessing = $state(false);
	let response = $state('');
	let error = $state('');

	let currentAgents = $derived(agents.list);
	let helperAgent = $derived(currentAgents.find((agent) => agent.getName() === 'Helper'));

	async function handleSearch() {
		if (!searchQuery.trim()) return;
		if (!helperAgent) {
			error = 'Helper agent not found. Please refresh the page.';
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
			response = await helperAgent.chat(searchQuery);
		} catch (err) {
			error = 'Failed to process your request';
			console.error(err);
		} finally {
			isProcessing = false;
		}
	}
</script>

<TopBar />

<div class="flex min-h-screen flex-col items-center justify-center px-4">
	<!-- Agents Display Section -->
	{#if currentAgents.length > 0}
		<div class="mb-8 w-full max-w-2xl">
			<h2 class="mb-4 text-xl font-semibold text-gray-700">
				Active Agents ({currentAgents.length})
			</h2>
			<div class="space-y-4">
				{#each currentAgents as agent}
					{@render agentCard(agent)}
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
				class="w-full rounded-full border border-gray-300 px-5 py-3 text-lg shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				placeholder="What can we help you with?"
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<button
				class="absolute top-1/2 right-3 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
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

{#snippet agentCard(agent: Agent)}
	{@const messages = agent.getMessageLog()}
	{@const state = agent.getState()}
	<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
		<div class="flex items-center gap-4">
			{#if agent.getProfilePicture()}
				<img
					src={agent.getProfilePicture()}
					alt="{agent.getName()}'s profile"
					class="h-16 w-16 rounded-full object-cover"
				/>
			{:else}
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200">
					<span class="text-2xl text-gray-400">{agent.getName()[0].toUpperCase()}</span>
				</div>
			{/if}
			<div class="flex-1">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-medium text-gray-900">{agent.getName()}</h3>
					<div class="flex items-center gap-2">
						<span class="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
							{agent.isAgentActive() ? 'Active' : 'Standby'}
						</span>
						<span
							class="rounded-full px-3 py-1 text-sm font-medium"
							class:bg-gray-100={state === 'IDLE'}
							class:text-gray-800={state === 'IDLE'}
							class:bg-blue-100={state === 'VOICE_ACTIVE'}
							class:text-blue-800={state === 'VOICE_ACTIVE'}
							class:bg-red-100={state === 'LEFT_CALL'}
							class:text-red-800={state === 'LEFT_CALL'}
							class:bg-yellow-100={state === 'WORKING'}
							class:text-yellow-800={state === 'WORKING'}
							class:bg-purple-100={state === 'RAISED_HAND'}
							class:text-purple-800={state === 'RAISED_HAND'}
						>
							{state}
						</span>
					</div>
				</div>
				<p class="mt-2 text-sm text-gray-600">{agent.getPersonality()}</p>
			</div>
		</div>
		{#if agent.getTools().length > 0}
			<div class="mt-3">
				<p class="text-sm font-medium text-gray-700">Tools:</p>
				<div class="mt-1 flex flex-wrap gap-2">
					{#each agent.getTools() as tool}
						<span class="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
							{tool.getDefinition().function.name}
						</span>
					{/each}
				</div>
			</div>
		{/if}
		{#if agent.getTodos().length > 0}
			<div class="mt-4">
				<p class="text-sm font-medium text-gray-700">Todo List:</p>
				<div class="mt-2 space-y-2">
					{#each agent.getTodos() as todo}
						<div class="flex items-center justify-between rounded-lg bg-gray-50 p-3">
							<div>
								<h4 class="font-medium text-gray-900">{todo.title}</h4>
								<p class="text-sm text-gray-600">{todo.description}</p>
							</div>
							<div class="flex items-center gap-2">
								<span
									class="rounded-full px-2 py-1 text-xs font-medium"
									class:bg-red-100={todo.priority === 'high'}
									class:text-red-800={todo.priority === 'high'}
									class:bg-yellow-100={todo.priority === 'medium'}
									class:text-yellow-800={todo.priority === 'medium'}
									class:bg-green-100={todo.priority === 'low'}
									class:text-green-800={todo.priority === 'low'}
								>
									{todo.priority}
								</span>
								<span
									class="rounded-full px-2 py-1 text-xs font-medium"
									class:bg-blue-100={todo.status === 'pending'}
									class:text-blue-800={todo.status === 'pending'}
									class:bg-purple-100={todo.status === 'in_progress'}
									class:text-purple-800={todo.status === 'in_progress'}
									class:bg-green-100={todo.status === 'completed'}
									class:text-green-800={todo.status === 'completed'}
								>
									{todo.status}
								</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
		<!-- Message Log Section -->
		{#if messages.length > 0}
			<div class="mt-4">
				<p class="text-sm font-medium text-gray-700">Message Log:</p>
				<div class="mt-2 space-y-2">
					{#each messages as message}
						<div class="rounded-lg bg-gray-50 p-3">
							<div class="flex items-center gap-2">
								<span class="font-medium text-gray-900">{message.role}:</span>
								<p class="text-sm text-gray-600">{message.content}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/snippet}
