<script lang="ts">
	import type { Agent } from '$lib/utils/agent.svelte';

	let { agent } = $props<{ agent: Agent }>();
	let isMessageLogVisible = $state(false);
	let messages = $derived(agent.getMessageLog());
	let state = $derived(agent.getState());

	// Reset visibility when agent changes
	$effect(() => {
		agent;
		isMessageLogVisible = false;
	});
</script>

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
	<!-- Message Log Toggle Button -->
	{#if messages.length > 0}
		<div class="mt-4 flex items-center justify-between">
			<button
				onclick={() => (isMessageLogVisible = !isMessageLogVisible)}
				class="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 transition-transform duration-200"
					class:rotate-90={isMessageLogVisible}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
				Message Log ({messages.length})
			</button>
		</div>
		<!-- Message Log Section -->
		{#if isMessageLogVisible}
			<div class="mt-2 space-y-2">
				{#each messages as message}
					<div class="rounded-lg bg-gray-50 p-3">
						<div class="flex flex-col gap-1">
							<div class="flex items-center justify-between">
								<span class="font-medium text-gray-900">{message.role}:</span>
								<span class="text-xs text-gray-500">
									{new Date(message.timestamp).toLocaleString()}
								</span>
							</div>
							<p class="text-sm text-gray-600">{message.content}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
