<script lang="ts">
	import { agents } from '$lib/stores/agents.svelte';
	import type { Agent } from '$lib/utils/agent.svelte';
	import { cn } from '$lib/utils/tw';
	import TextScramble from './TextScramble.svelte';

	const { agent }: { agent: Agent } = $props();
	let showPopup = $state(false);
	let showMessages = $state(false);
	let messages = $derived(agent.getMessageLog());

	let todos = $derived(agent.getTodos());
	let activeTodos = $derived(todos.filter((todo) => todo.status !== 'completed'));

	function togglePopup() {
		showPopup = !showPopup;
		if (!showPopup) showMessages = false;
	}

	let stateClasses = $derived(() => {
		switch (agent.getState()) {
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

	function getStatusColor(status: string) {
		switch (status) {
			case 'pending':
				return 'bg-gray-500 text-white';
			case 'in_progress':
				return 'bg-blue-500 text-white';
			case 'completed':
				return 'bg-green-500 text-white';
			default:
				return 'bg-gray-500 text-white';
		}
	}
</script>

<div
	onclick={togglePopup}
	onkeydown={(e) => e.key === 'Enter' && togglePopup()}
	role="button"
	tabindex="0"
	class={cn(
		'group flex w-full cursor-pointer flex-col items-center justify-center gap-2 border border-white bg-black p-3 transition-all duration-200 hover:bg-orange-500/15',
		agent.getState() === 'ACTIVE' ? 'border-[#FF6222]' : '',
		agent.getState() === 'IDLE' ? 'border-gray-500' : '',
		agent.getState() === 'WORKING' ? 'border-white' : 'border-gray-500',
		agent.isSpeakingNow() ? 'border-orange-500' : ''
	)}
>
	<div class="flex w-full flex-col items-center justify-center gap-2">
		<!-- Agent Info -->
		<div class="w-full text-center">
			<h2 class="line-clamp-1 text-xl font-bold text-white">
				{agent.getName()}
				{#if activeTodos.length > 0}
					<span
						class="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-1.5 text-xs font-medium text-white shadow-sm shadow-orange-500/20"
					>
						{activeTodos.length}
					</span>
				{/if}
			</h2>
		</div>
		<!-- Image container -->
		<div class="relative aspect-square w-full">
			{#if agent.getProfilePicture()}
				<img
					src={agent.getProfilePicture()}
					alt={agent.getName()}
					class="h-full w-full rounded-full bg-gray-900 object-cover shadow-lg ring-2 ring-white/20"
				/>
			{:else}
				<div
					class="flex h-full w-full items-center justify-center rounded-full bg-gray-900 shadow-lg ring-2 ring-white/20"
				>
					<span class="text-4xl text-white">{agent.getName()[0].toUpperCase()}</span>
				</div>
			{/if}
			{#if agent.getState() === 'ACTIVE' && agents.mode === 'VOICE' && agent.getIsConnectedToConversation()}
				<div
					class="absolute bottom-2 right-1/2 flex aspect-square w-1/4 translate-x-1/2 items-center justify-center rounded-full border-2 border-[#FF6222] bg-white shadow-lg"
				>
					<div class="audio-wave">
						<div class="bar"></div>
						<div class="bar"></div>
						<div class="bar"></div>
					</div>
				</div>
			{/if}
		</div>
		<!-- State text -->
		{#if agent.getState() === 'ACTIVE' && agents.mode === 'VOICE'}
			{#if agent.getIsConnectedToConversation()}
				<span class="text-center font-['Anonymous_Pro'] text-lg font-bold text-green-500">
					Connected
				</span>
			{:else}
				<span class="text-center font-['Anonymous_Pro'] text-lg font-bold text-red-500">
					Connecting...
				</span>
			{/if}
		{:else}
			<span
				class="text-center font-['Anonymous_Pro'] text-lg font-bold {agent.getState() === 'ACTIVE'
					? 'text-[#FF6222]'
					: 'text-white'}"
			>
				{agent.getState()}
			</span>
		{/if}
	</div>
</div>

<!-- Popup overlay -->
{#if showPopup}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300"
		onclick={togglePopup}
		onkeydown={(e) => e.key === 'Enter' && togglePopup()}
		role="button"
		tabindex="0"
	>
		<!-- Popup content -->
		<div
			class="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/20 bg-black p-6 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.key === 'Enter' && togglePopup()}
			role="button"
			tabindex="0"
		>
			<!-- Header -->
			<div class="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
				<h2 class="text-2xl font-bold text-white">Agent Details</h2>
				<button
					onclick={togglePopup}
					class="rounded-full p-2 text-white transition-colors hover:bg-white/10"
					onkeydown={(e) => e.key === 'Enter' && togglePopup()}
					tabindex="0"
					aria-label="Close"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Agent info -->
			<div class="mb-6 flex items-center gap-4">
				{#if agent.getProfilePicture()}
					<img
						src={agent.getProfilePicture()}
						alt="{agent.getName()}'s profile"
						class="h-24 w-24 rounded-full object-cover ring-2 ring-white/20"
					/>
				{:else}
					<div
						class="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/20"
					>
						<span class="text-4xl text-white">{agent.getName()[0].toUpperCase()}</span>
					</div>
				{/if}
				<div class="flex-1">
					<div class="flex items-center justify-between">
						<h3 class="text-2xl font-medium text-white">{agent.getName()}</h3>
						<div class="min-w-[100px]">
							<TextScramble
								text={agent.getState()}
								class="rounded-full px-3 py-1 text-sm font-medium {stateClasses}"
							/>
						</div>
					</div>
					<p class="mt-2 text-lg text-white/80">{agent.getPersonality()}</p>
				</div>
			</div>

			<!-- Tools section -->
			{#if agent.getTools().length > 0}
				<div class="mb-6 rounded-lg bg-white/5 p-4">
					<h4 class="mb-3 text-lg font-medium text-white">Tools</h4>
					<div class="flex flex-wrap gap-2">
						{#each agent.getTools() as tool}
							<span
								class="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
							>
								{tool.getDefinition().function.name}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Todo list section -->
			{#if activeTodos.length > 0}
				<div class="mb-6 rounded-lg bg-white/5 p-4">
					<h4 class="mb-3 text-lg font-medium text-white">Todo List</h4>
					<div class="grid gap-3">
						{#each activeTodos as todo}
							<div class="rounded-lg bg-white/10 p-4 transition-all duration-200 hover:bg-white/15">
								<div class="flex flex-col gap-2">
									<div class="flex items-start justify-between">
										<div>
											<h5 class="text-lg font-medium text-white">{todo.title}</h5>
											<p class="mt-1 text-sm text-white/80">{todo.description}</p>
										</div>
										<div class="flex flex-col items-end gap-2">
											<span
												class="rounded-full px-3 py-1 text-xs font-medium {getPriorityColor(
													todo.priority
												)}"
											>
												{todo.priority}
											</span>
											<span
												class="rounded-full px-3 py-1 text-xs font-medium {getStatusColor(
													todo.status
												)}"
											>
												{todo.status}
											</span>
										</div>
									</div>
									{#if todo.requestedBy}
										<div class="mt-1 text-xs text-white/60">
											Requested by: {todo.requestedBy}
										</div>
									{/if}
									<div class="flex justify-between text-xs text-white/60">
										<span>Created: {new Date(todo.createdAt).toLocaleDateString()}</span>
										{#if todo.completedAt}
											<span>Completed: {new Date(todo.completedAt).toLocaleDateString()}</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Message log section -->
			{#if messages.length > 0}
				<div class="rounded-lg bg-white/5 p-4">
					<button
						onclick={() => (showMessages = !showMessages)}
						class="mb-3 flex w-full items-center justify-between rounded-lg p-2 text-white transition-colors hover:bg-white/10"
					>
						<span class="text-lg font-medium">Message Log ({messages.length})</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5 transition-transform duration-200"
							class:rotate-90={showMessages}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>

					{#if showMessages}
						<div class="grid gap-3">
							{#each messages as message}
								<div
									class="overflow-y-auto rounded-lg bg-white/10 p-4 transition-all duration-200 hover:bg-white/15"
								>
									<div class="flex flex-col gap-2">
										<div class="flex items-center justify-between">
											<span class="font-medium text-white">{message.role}</span>
											<span class="text-xs text-white/60">
												{new Date(message.timestamp).toLocaleString()}
											</span>
										</div>
										<p class="overflow-y-auto text-sm text-white/80">{message.content}</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.audio-wave {
		display: flex;
		align-items: center;
		gap: clamp(1px, 0.4vw, 3px);
		height: clamp(8px, 4vw, 16px);
	}

	.bar {
		width: clamp(2px, 0.8vw, 6px);
		height: clamp(10px, 2vw, 16px);
		background: #ff6222;
		animation: wave 1s ease-in-out infinite;
	}

	.bar:nth-child(2) {
		animation-delay: 0.1s;
	}

	.bar:nth-child(3) {
		animation-delay: 0.2s;
	}

	.bar:nth-child(4) {
		animation-delay: 0.3s;
	}

	@keyframes wave {
		0%,
		10%,
		90%,
		100% {
			height: clamp(10px, 2vw, 16px);
		}
		45%,
		55% {
			height: clamp(20px, 4vw, 32px);
		}
	}

	.typing-dots {
		display: flex;
		align-items: center;
		gap: clamp(2px, 0.5vw, 4px);
	}

	.dot {
		width: clamp(4px, 1vw, 8px);
		height: clamp(4px, 1vw, 8px);
		background: #ff6222;
		border-radius: 50%;
		animation: jump 1s ease-in-out infinite;
	}

	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes jump {
		0%,
		10%,
		90%,
		100% {
			transform: translateY(0);
		}
		45%,
		55% {
			transform: translateY(-8px);
		}
	}
</style>
