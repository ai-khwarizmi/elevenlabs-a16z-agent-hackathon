<script lang="ts">
	import { startMainLoop } from '$lib/orchestration.svelte';
	import '../app.css';
	let { children } = $props();

	$effect(() => {
		startMainLoop();
	});
</script>

{@render children()}
