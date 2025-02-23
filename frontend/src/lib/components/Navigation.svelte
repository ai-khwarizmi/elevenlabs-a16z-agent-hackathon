<script lang="ts">
	import { sessions } from '$lib/stores/agents.svelte';
	import { showApiKeysPopup } from '$lib/stores/apiKeys';
	import ApiKeyInputs from './ApiKeyInputs.svelte';
	import Logo from './Logo.svelte';

	let { isTranscriptExpanded = $bindable(true) } = $props();
	let sessionList = $derived(sessions.list);
	let currentSession = $derived(sessions.current);

	function handleSessionChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		sessions.loadSession(select.value);
	}

	function handleCreateSession() {
		const sessionNumber = sessionList.length + 1;
		sessions.createSession(`Session ${sessionNumber}`);
	}
</script>

<nav
	class="fixed left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-white bg-black px-8 py-4 text-white"
	class:pr-[calc(384px+2rem)]={isTranscriptExpanded}
>
	<div class="flex items-center justify-between gap-8">
		<Logo size="small" />
		<a href="/" class="font-medium text-white transition-opacity duration-200 ease-in-out">
			Home
		</a>
		<a href="/about" class="font-medium text-white transition-opacity duration-200 ease-in-out">
			About
		</a>
	</div>

	<div class="flex items-center gap-2">
		<button
			onclick={() => showApiKeysPopup()}
			class="border border-white bg-black px-3 py-2 font-['Anonymous_Pro'] text-sm text-white transition-all duration-200 hover:border-[#FF6222]"
		>
			API Keys
		</button>

		{#if sessionList.length > 1}
			<select
				value={currentSession?.id}
				onchange={handleSessionChange}
				class="box-border border border-white bg-black px-3 py-2.5 font-['Anonymous_Pro'] text-sm text-white transition-all duration-200 focus:border-[#FF6222] focus:outline-none"
			>
				{#each sessionList as session}
					<option value={session.id}>{session.name}</option>
				{/each}
			</select>

			<button
				onclick={handleCreateSession}
				class="border border-white bg-black px-3 py-2 font-['Anonymous_Pro'] text-sm text-white transition-all duration-200 hover:border-[#FF6222]"
			>
				New Session
			</button>
		{/if}
	</div>
</nav>

<ApiKeyInputs />
