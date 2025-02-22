<script lang="ts">
	import ApiKeyInputs from './ApiKeyInputs.svelte';
	import { sessions } from '$lib/stores/agents.svelte';

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

<div class="fixed top-0 left-0 z-50 flex w-full items-start justify-between p-4">
	<div>
		<ApiKeyInputs />
	</div>

	<div class="mr-4 flex items-center gap-2">
		<select
			value={currentSession?.id}
			onchange={handleSessionChange}
			class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-all duration-200 hover:bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		>
			{#each sessionList as session}
				<option value={session.id}>{session.name}</option>
			{/each}
		</select>

		<button
			onclick={handleCreateSession}
			class="rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		>
			New Session
		</button>
	</div>
</div>
