<script lang="ts">
	import { validateOpenAIKey, validateElevenLabsKey, validateFalKey } from '$lib/api/validation';
	import {
		getStoredKeys,
		storeOpenAIKey,
		storeElevenLabsKey,
		storeFalKey
	} from '$lib/storage/keys';

	let openaiKey = $state('');
	let elevenLabsKey = $state('');
	let falKey = $state('');
	let isValidatingOpenAI = $state(false);
	let isValidatingElevenLabs = $state(false);
	let isValidatingFal = $state(false);
	let openAIError = $state('');
	let elevenLabsError = $state('');
	let falError = $state('');
	let isCompact = $state(false);
	let isOpenAIValid = $state(false);
	let isElevenLabsValid = $state(false);
	let isFalValid = $state(false);

	// Load keys from localStorage on mount
	$effect(() => {
		const {
			openaiKey: storedOpenAIKey,
			elevenLabsKey: storedElevenLabsKey,
			falKey: storedFalKey
		} = getStoredKeys();
		if (storedOpenAIKey) {
			openaiKey = storedOpenAIKey;
			isOpenAIValid = true;
		}
		if (storedElevenLabsKey) {
			elevenLabsKey = storedElevenLabsKey;
			isElevenLabsValid = true;
		}
		if (storedFalKey) {
			falKey = storedFalKey;
			isFalValid = true;
		}
		if (storedOpenAIKey && storedElevenLabsKey && storedFalKey) {
			isCompact = true;
		}
	});

	async function handleOpenAIKeyValidation() {
		if (!openaiKey) return;

		isValidatingOpenAI = true;
		openAIError = '';

		const result = await validateOpenAIKey(openaiKey);

		if (result.isValid) {
			storeOpenAIKey(openaiKey);
			isOpenAIValid = true;
			if (isElevenLabsValid && isFalValid) {
				setTimeout(() => {
					isCompact = true;
				}, 500); // Wait for success animation
			}
		} else {
			openAIError = result.error || 'Invalid API key';
			isOpenAIValid = false;
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
			isElevenLabsValid = true;
			if (isOpenAIValid && isFalValid) {
				setTimeout(() => {
					isCompact = true;
				}, 500); // Wait for success animation
			}
		} else {
			elevenLabsError = result.error || 'Invalid API key';
			isElevenLabsValid = false;
		}

		isValidatingElevenLabs = false;
	}

	async function handleFalKeyValidation() {
		if (!falKey) return;

		isValidatingFal = true;
		falError = '';

		try {
			const result = await validateFalKey(falKey);

			if (result.isValid) {
				storeFalKey(falKey);
				isFalValid = true;
				if (isOpenAIValid && isElevenLabsValid) {
					setTimeout(() => {
						isCompact = true;
					}, 500);
				}
			} else {
				falError = result.error || 'Invalid API key';
				isFalValid = false;
			}
		} catch {
			falError = 'Failed to validate API key';
			isFalValid = false;
		}

		isValidatingFal = false;
	}

	// Validate keys when they change
	$effect(() => {
		if (openaiKey) handleOpenAIKeyValidation();
	});

	$effect(() => {
		if (elevenLabsKey) handleElevenLabsKeyValidation();
	});

	$effect(() => {
		if (falKey) handleFalKeyValidation();
	});

	function expandInputs() {
		isCompact = false;
	}

	function closeInputs() {
		isCompact = true;
	}
</script>

{#if isCompact}
	<button
		onclick={expandInputs}
		class="left-4 top-4 flex items-center space-x-2 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 border border-green-700/20 transition-all duration-200 hover:bg-green-100"
	>
		<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path
				fill-rule="evenodd"
				d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
				clip-rule="evenodd"
			/>
		</svg>
		<span>API Keys Ready</span>
	</button>
{:else}
	<div class="fixed bg-black border border-white text-white p-8 left-4 top-4 w-64 space-y-4">
		<div class="flex justify-end">
			<button
			onclick={closeInputs}
			class="left-4 top-4 flex items-center space-x-2 bg-black px-3 py-2 text-sm font-medium text-white border border-white/20 transition-all duration-200 hover:bg-white/10"
		>
			Close
		</button>
		</div>
		<div class="space-y-2">
			<label for="openai-key" class="block text-sm font-medium text-white">OpenAI API Key</label>
			<div class="relative">
				<input
					id="openai-key"
					type="password"
					bind:value={openaiKey}
					class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 {openAIError
						? 'border-red-500'
						: ''} {isOpenAIValid ? 'border-green-500 bg-green-900' : ''}"
					placeholder="Enter OpenAI API Key"
				/>
				{#if isValidatingOpenAI}
					<div class="absolute right-2 top-1/2 -translate-y-1/2">
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
						></div>
					</div>
				{:else if isOpenAIValid}
					<div class="absolute right-2 top-1/2 -translate-y-1/2 text-green-500">
						<svg
							class="h-5 w-5"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
								clip-rule="evenodd"
							/>
						</svg>
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
			<label for="elevenlabs-key" class="block text-sm font-medium text-white"
				>ElevenLabs API Key</label
			>
			<div class="relative">
				<input
					id="elevenlabs-key"
					type="password"
					bind:value={elevenLabsKey}
					class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 {elevenLabsError
						? 'border-red-500'
						: ''} {isElevenLabsValid ? 'border-green-500 bg-green-900' : ''}"
					placeholder="Enter ElevenLabs API Key"
				/>
				{#if isValidatingElevenLabs}
					<div class="absolute right-2 top-1/2 -translate-y-1/2">
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
						></div>
					</div>
				{:else if isElevenLabsValid}
					<div class="absolute right-2 top-1/2 -translate-y-1/2 text-green-500">
						<svg
							class="h-5 w-5"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
				{/if}
			</div>
			<div class="h-5 overflow-hidden">
				{#if elevenLabsError}
					<p class="text-sm text-red-500 transition-all duration-200">{elevenLabsError}</p>
				{/if}
			</div>
		</div>
		<div class="space-y-2">
			<label for="fal-key" class="block text-sm font-medium text-white">FAL API Key</label>
			<div class="relative">
				<input
					id="fal-key"
					type="password"
					bind:value={falKey}
					class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 {falError
						? 'border-red-500'
						: ''} {isFalValid ? 'border-green-500 bg-green-900' : ''}"
					placeholder="Enter FAL API Key"
				/>
				{#if isValidatingFal}
					<div class="absolute right-2 top-1/2 -translate-y-1/2">
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
						></div>
					</div>
				{:else if isFalValid}
					<div class="absolute right-2 top-1/2 -translate-y-1/2 text-green-500">
						<svg
							class="h-5 w-5"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
				{/if}
			</div>
			<div class="h-5 overflow-hidden">
				{#if falError}
					<p class="text-sm text-red-500 transition-all duration-200">{falError}</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
