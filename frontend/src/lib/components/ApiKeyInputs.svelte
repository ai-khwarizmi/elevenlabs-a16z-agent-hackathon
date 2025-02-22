<script lang="ts">
	import { validateOpenAIKey, validateElevenLabsKey } from '$lib/api/validation';
	import { getStoredKeys, storeOpenAIKey, storeElevenLabsKey } from '$lib/storage/keys';

	let openaiKey = $state('');
	let elevenLabsKey = $state('');
	let isValidatingOpenAI = $state(false);
	let isValidatingElevenLabs = $state(false);
	let openAIError = $state('');
	let elevenLabsError = $state('');

	// Load keys from localStorage on mount
	$effect(() => {
		const { openaiKey: storedOpenAIKey, elevenLabsKey: storedElevenLabsKey } = getStoredKeys();
		if (storedOpenAIKey) openaiKey = storedOpenAIKey;
		if (storedElevenLabsKey) elevenLabsKey = storedElevenLabsKey;
	});

	async function handleOpenAIKeyValidation() {
		if (!openaiKey) return;

		isValidatingOpenAI = true;
		openAIError = '';

		const result = await validateOpenAIKey(openaiKey);

		if (result.isValid) {
			storeOpenAIKey(openaiKey);
		} else {
			openAIError = result.error || 'Invalid API key';
		}

		isValidatingOpenAI = false;
	}

	async function handleElevenLabsKeyValidation() {
		if (!elevenLabsKey) return;

		isValidatingElevenLabs = true;
		elevenLabsError = '';

		const result = await validateElevenLabsKey(elevenLabsKey);

		if (result.isValid) {
			storeElevenLabsKey(elevenLabsKey);
		} else {
			elevenLabsError = result.error || 'Invalid API key';
		}

		isValidatingElevenLabs = false;
	}

	// Validate keys when they change
	$effect(() => {
		if (openaiKey) handleOpenAIKeyValidation();
	});

	$effect(() => {
		if (elevenLabsKey) handleElevenLabsKeyValidation();
	});
</script>

<div class="fixed top-4 left-4 w-64 space-y-4">
	<div class="space-y-2">
		<label for="openai-key" class="block text-sm font-medium text-gray-700">OpenAI API Key</label>
		<div class="relative">
			<input
				id="openai-key"
				type="password"
				bind:value={openaiKey}
				class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none {openAIError
					? 'border-red-500'
					: ''}"
				placeholder="Enter OpenAI API Key"
			/>
			{#if isValidatingOpenAI}
				<div class="absolute top-1/2 right-2 -translate-y-1/2">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
					></div>
				</div>
			{/if}
		</div>
		<div class="h-5 overflow-hidden">
			{#if openAIError}
				<p class="text-sm text-red-500 transition-all duration-200">{openAIError}</p>
			{/if}
		</div>
	</div>
	<div class="space-y-2">
		<label for="elevenlabs-key" class="block text-sm font-medium text-gray-700"
			>ElevenLabs API Key</label
		>
		<div class="relative">
			<input
				id="elevenlabs-key"
				type="password"
				bind:value={elevenLabsKey}
				class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none {elevenLabsError
					? 'border-red-500'
					: ''}"
				placeholder="Enter ElevenLabs API Key"
			/>
			{#if isValidatingElevenLabs}
				<div class="absolute top-1/2 right-2 -translate-y-1/2">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
					></div>
				</div>
			{/if}
		</div>
		<div class="h-5 overflow-hidden">
			{#if elevenLabsError}
				<p class="text-sm text-red-500 transition-all duration-200">{elevenLabsError}</p>
			{/if}
		</div>
	</div>
</div>
