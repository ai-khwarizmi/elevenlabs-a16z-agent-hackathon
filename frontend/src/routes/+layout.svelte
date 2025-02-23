<script lang="ts">
	import { startMainLoop } from '$lib/orchestration.svelte';
	import ChatTranscript from '$lib/components/ChatTranscript.svelte';
	import FilesystemManager from '$lib/components/FilesystemManager.svelte';
	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import '../app.css';
	import Navigation from '$lib/components/Navigation.svelte';
	import GlitchNotification from '$lib/components/GlitchNotification.svelte';
	import Dots from '$lib/assets/icons/dots.svg';

	let { children } = $props();
	let isTranscriptExpanded = $state(false);

	$effect(() => {
		startMainLoop();
	});
</script>

<GlitchNotification />
<FilesystemManager />
<Navigation bind:isTranscriptExpanded />
<div class="transition-[padding] duration-300 pt-16 bg-black" class:pr-96={isTranscriptExpanded}>
	{@render children()}
</div>
<FileExplorer />
