<script lang="ts">
	import { startMainLoop } from '$lib/orchestration.svelte';
	import ChatTranscript from '$lib/components/ChatTranscript.svelte';
	import FilesystemManager from '$lib/components/FilesystemManager.svelte';
	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import '../app.css';
	import Navigation from '$lib/components/Navigation.svelte';
	import GlitchNotification from '$lib/components/GlitchNotification.svelte';

	let { children } = $props();
	let isTranscriptExpanded = $state(false);

	$effect(() => {
		startMainLoop();
	});
</script>

<GlitchNotification />
<FilesystemManager />
<Navigation bind:isTranscriptExpanded />
<div class="pt-16 transition-[padding] duration-300" class:pr-96={isTranscriptExpanded}>
	{@render children()}
</div>
<!-- <ChatTranscript bind:isExpanded={isTranscriptExpanded} /> -->
<FileExplorer />
