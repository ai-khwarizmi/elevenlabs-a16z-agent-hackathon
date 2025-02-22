<script lang="ts">
	import { startMainLoop } from '$lib/orchestration.svelte';
	import ChatTranscript from '$lib/components/ChatTranscript.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import FilesystemManager from '$lib/components/FilesystemManager.svelte';
	import '../app.css';

	let { children } = $props();
	let isTranscriptExpanded = $state(true);

	$effect(() => {
		startMainLoop();
	});
</script>

<FilesystemManager />
<TopBar bind:isTranscriptExpanded />
<div class="transition-[padding] duration-300" class:pr-96={isTranscriptExpanded}>
	{@render children()}
</div>
<ChatTranscript bind:isExpanded={isTranscriptExpanded} />
