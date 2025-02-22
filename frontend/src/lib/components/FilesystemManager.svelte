<script lang="ts">
	import { sessions } from '$lib/stores/agents.svelte';
	import { filesystem } from '$lib/stores/filesystem.svelte';

	let currentSession = $derived(sessions.current);

	$effect(() => {
		if (currentSession && currentSession.id !== filesystem.currentSessionId) {
			filesystem.switchSession(currentSession.id);
		}
	});
</script>
