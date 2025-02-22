<script lang="ts">
	import { agents } from '$lib/stores/agents.svelte';
	import type { TimestampedMessage } from '$lib/types/messages';
	import AppButton from './AppButton.svelte';
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
	class="fixed top-16 right-0 z-50 flex h-screen flex-col transition-transform duration-300"
	class:translate-x-0={isExpanded}
	class:translate-x-96={!isExpanded}
>
	<!-- Transcript panel -->
	<div class="h-full w-96 bg-black text-white shadow-lg border-l border-white">

		<!-- Footer with toggle button -->
		 {#if !isExpanded}
		<div class="relative">
			<div class="absolute top-2 -left-50">
				<AppButton 
					variant="secondary" 
					text={isExpanded ? '>' : 'Show transcript'} 
					onClick={() => (isExpanded = !isExpanded)} 
				/>
			</div>
		</div>
		{/if}

		<!-- Header -->
		<div class="border-b border-gray-200  p-4 flex justify-between items-center">
			<TextScramble text="Transcript" />
			{#if isExpanded}
				<AppButton 
					variant="secondary" 
					text='Close'
					onClick={() => (isExpanded = !isExpanded)} 
				/>
			{/if}
		</div>

		<!-- Messages -->
		<div class="flex h-[calc(100vh-8rem)] flex-col overflow-y-auto p-4">
			<div class="flex-1 space-y-4">
				{#each messages as message}
					<div class="flex flex-col gap-1">
						<div class="flex items-center justify-between">
							<span class="font-medium text-white">
								{#if message.role === 'assistant'}
									<TextScramble text={message.name || ''} />
								{:else}
									<TextScramble text="User" />
								{/if}
							</span>
							<span class="text-xs ">
								<TextScramble text={formatTime(message.timestamp)} />
							</span>
						</div>
						<p class="rounded-lg  p-3 text-sm ">
							<TextScramble text={getMessageContent(message)} />
						</p>
						<div class="h-[1px] bg-white"></div>
					</div>
				{:else}
					<div class="flex h-full items-center justify-center">
						<TextScramble text="No messages yet" />
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
