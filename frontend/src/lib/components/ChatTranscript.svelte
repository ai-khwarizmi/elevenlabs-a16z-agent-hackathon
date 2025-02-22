<script lang="ts">
	import { agents } from '$lib/stores/agents.svelte';
	import type { TimestampedMessage } from '$lib/types/messages';
	import TextScramble from './TextScramble.svelte';

	let { isExpanded = $bindable(true) } = $props();
	let messages = $derived(agents.getGlobalChatlog());

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getMessageContent(message: TimestampedMessage): string {
		return typeof message.content === 'string' ? message.content : '';
	}
</script>

<div
	class="fixed top-0 right-0 z-50 flex h-screen flex-col transition-transform duration-300"
	class:translate-x-0={isExpanded}
	class:translate-x-96={!isExpanded}
>
	<!-- Transcript panel -->
	<div class="h-full w-96 bg-white shadow-lg">
		<!-- Header -->
		<div class="border-b border-gray-200 bg-gray-50 p-4">
			<TextScramble text="Transcript" />
		</div>

		<!-- Messages -->
		<div class="flex h-[calc(100vh-8rem)] flex-col overflow-y-auto p-4">
			<div class="flex-1 space-y-4">
				{#each messages as message}
					<div class="flex flex-col gap-1">
						<div class="flex items-center justify-between">
							<span class="font-medium text-gray-900">
								{#if message.role === 'assistant'}
									<TextScramble text={message.name || ''} />
								{:else}
									<TextScramble text="User" />
								{/if}
							</span>
							<span class="text-xs text-gray-500">
								<TextScramble text={formatTime(message.timestamp)} />
							</span>
						</div>
						<p class="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
							<TextScramble text={getMessageContent(message)} />
						</p>
					</div>
				{:else}
					<div class="flex h-full items-center justify-center text-gray-500">
						<TextScramble text="No messages yet" />
					</div>
				{/each}
			</div>
		</div>

		<!-- Footer with toggle button -->
		<div class="relative border-t border-gray-200 bg-gray-50 p-4">
			<button
				class="absolute bottom-4 -left-10 rounded-l-lg bg-gray-100 p-2 shadow-md hover:bg-gray-200"
				onclick={() => (isExpanded = !isExpanded)}
				aria-label={isExpanded ? 'Hide transcript' : 'Show transcript'}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 transition-transform duration-300"
					class:rotate-180={!isExpanded}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>
		</div>
	</div>
</div>
