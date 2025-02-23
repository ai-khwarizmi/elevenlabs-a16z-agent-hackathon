<script lang="ts">
	import type { Agent } from '$lib/utils/agent.svelte';
	import type { Todo } from '$lib/utils/agent.svelte';
	import type { AgentState } from '$lib/utils/agent.svelte';
	import TextScramble from './TextScramble.svelte';

	const { agent }: { agent: Agent } = $props();
	let showMessages = $state(false);
	let messages = $derived(agent.getMessageLog());
	let agentState = $derived(agent.getState());
	let todos = $state<Todo[]>([]);

	$effect(() => {
		agent;
		showMessages = false;
	});

	$effect(() => {
		agent.getTodos().then((newTodos) => {
			todos = newTodos;
		});
	});

	let stateClasses = $derived(() => {
		switch (agentState) {
			case 'IDLE':
				return 'bg-gray-100 text-gray-800';
			case 'ACTIVE':
				return 'bg-blue-100 text-blue-800';
			case 'LEFT_CALL':
				return 'bg-red-100 text-red-800';
			case 'WORKING':
				return 'bg-yellow-100 text-yellow-800';
			case 'RAISED_HAND':
				return 'bg-purple-100 text-purple-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	});

	function getPriorityColor(priority: string) {
		switch (priority) {
			case 'high':
				return 'bg-red-500 text-white';
			case 'medium':
				return 'bg-yellow-500 text-black';
			case 'low':
				return 'bg-green-500 text-white';
			default:
				return 'bg-gray-500 text-white';
		}
	}

	function getStatusColor(status: 'pending' | 'completed'): string {
		switch (status) {
			case 'pending':
				return 'bg-gray-500 text-white';
			case 'completed':
				return 'bg-green-500 text-white';
			default:
				return 'bg-gray-500 text-white';
		}
	}
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
				{agent.getVoiceId()} :: {agent.getElevenLabsAgentId()}
				<div class="flex items-center gap-2">
					<div class="min-w-[100px] flex-shrink-0 text-center">
						<TextScramble
							text={agentState}
							class="rounded-full px-3 py-1 text-sm font-medium {stateClasses}"
						/>
					</div>
				</div>
			</div>
			<p class="mt-2 text-sm text-gray-600">
				{agent.getPersonality()}
			</p>
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
	{#if todos.length > 0}
		<div class="mt-4">
			<p class="text-sm font-medium text-gray-700">Todo List:</p>
			<div class="mt-2 space-y-2">
				{#each todos as todo}
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
				onclick={() => (showMessages = !showMessages)}
				class="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 transition-transform duration-200"
					class:rotate-90={showMessages}
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
		{#if showMessages}
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
