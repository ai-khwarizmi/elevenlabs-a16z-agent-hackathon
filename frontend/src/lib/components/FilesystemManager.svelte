<script lang="ts">
	import { sessions } from '$lib/stores/agents.svelte';
	import { filesystem } from '$lib/stores/filesystem.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let currentSession = $derived(sessions.current);
	let initError = $state<Error | null>(null);
	let mounted = $state(false);
	let initializationAttempted = $state(false);
	let isLoading = $state(false);

	// Only initialize on the client side
	onMount(async () => {
		if (!browser) {
			console.log('Not in browser environment, skipping filesystem initialization');
			return;
		}

		try {
			console.log('Initializing filesystem...');
			mounted = true;
			initializationAttempted = true;
			isLoading = true;

			if (currentSession) {
				console.log('Current session found, initializing with ID:', currentSession.id);
				await filesystem.init(currentSession.id);
				console.log('Filesystem initialized successfully');
			} else {
				console.log('No current session available');
			}
		} catch (e) {
			console.error('Failed to initialize filesystem:', e);
			initError = e instanceof Error ? e : new Error(String(e));
		} finally {
			isLoading = false;
		}
	});

	$effect(() => {
		if (!mounted || !browser || !initializationAttempted || isLoading) {
			return;
		}

		if (currentSession && currentSession.id !== filesystem.currentSessionId) {
			console.log('Switching filesystem session to:', currentSession.id);
			(async () => {
				try {
					isLoading = true;
					await filesystem.switchSession(currentSession.id);
					console.log('Successfully switched filesystem session');
				} catch (e) {
					console.error('Failed to switch filesystem session:', e);
					initError = e instanceof Error ? e : new Error(String(e));
				} finally {
					isLoading = false;
				}
			})();
		}
	});
</script>

{#if isLoading}
	<div class="p-4 text-blue-500">Loading filesystem...</div>
{:else if initError}
	<div class="p-4 text-red-500">
		Failed to initialize filesystem: {initError.message}
		{#if initError.stack}
			<pre class="mt-2 text-sm">{initError.stack}</pre>
		{/if}
	</div>
{/if}
