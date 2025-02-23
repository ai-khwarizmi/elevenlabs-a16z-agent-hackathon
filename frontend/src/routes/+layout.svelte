<script lang="ts">
	import { startMainLoop } from '$lib/orchestration.svelte';
	import ChatTranscript from '$lib/components/ChatTranscript.svelte';
	import FilesystemManager from '$lib/components/FilesystemManager.svelte';
	import FileExplorer from '$lib/components/FileExplorer.svelte';
	import '../app.css';
	import Navigation from '$lib/components/Navigation.svelte';
	import GlitchNotification from '$lib/components/GlitchNotification.svelte';
	import Dots from '$lib/assets/icons/dots.svg';
	import { dialog } from '$lib/stores/dialog.svelte';
	import type { DialogValues } from '$lib/stores/dialog.svelte';
	import Dialog from '$lib/components/Dialog.svelte';

	let { children } = $props();
	let isTranscriptExpanded = $state(false);

	$effect(() => {
		startMainLoop();
	});
</script>

<GlitchNotification />
<FilesystemManager />
<Navigation bind:isTranscriptExpanded />
<div class="bg-black pt-16 transition-[padding] duration-300" class:pr-96={isTranscriptExpanded}>
	{@render children()}
</div>
<FileExplorer />

{#if $dialog.isOpen && $dialog.options}
	<Dialog
		title={$dialog.options.title}
		description={$dialog.options.description}
		fields={$dialog.options.fields}
		timeout_seconds={$dialog.options.timeout_seconds}
		submit_button_text={$dialog.options.submit_button_text}
		cancel_button_text={$dialog.options.cancel_button_text}
		onSubmit={(values: DialogValues) => dialog.close(values)}
		onCancel={() => dialog.close(null)}
	/>
{/if}
