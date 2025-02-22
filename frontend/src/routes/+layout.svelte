<script lang="ts">
	import { startMainLoop } from '$lib/orchestration.svelte';
	import ChatTranscript from '$lib/components/ChatTranscript.svelte';
	import '../app.css';
	import Navigation from '$lib/components/Navigation.svelte';

	let { children } = $props();
	let isTranscriptExpanded = $state(true);

	$effect(() => {
		startMainLoop();
	});
</script>

<Navigation bind:isTranscriptExpanded />
<div class="transition-[padding] duration-300 pt-16" class:pr-96={isTranscriptExpanded}>
	{@render children()}
</div>
<ChatTranscript bind:isExpanded={isTranscriptExpanded} />
