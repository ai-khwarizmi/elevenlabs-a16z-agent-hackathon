<script lang="ts">
	let openaiKey = $state('');
	let elevenLabsKey = $state('');
	let searchQuery = $state('');

	function handleSearch() {
		// TODO: Implement search functionality
		console.log('Search query:', searchQuery);
	}
</script>

<!-- API Keys Section -->
<div class="fixed top-4 left-4 w-64 space-y-4">
	<div class="space-y-2">
		<label for="openai-key" class="block text-sm font-medium text-gray-700">OpenAI API Key</label>
		<input
			id="openai-key"
			type="password"
			bind:value={openaiKey}
			class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			placeholder="Enter OpenAI API Key"
		/>
	</div>
	<div class="space-y-2">
		<label for="elevenlabs-key" class="block text-sm font-medium text-gray-700"
			>ElevenLabs API Key</label
		>
		<input
			id="elevenlabs-key"
			type="password"
			bind:value={elevenLabsKey}
			class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			placeholder="Enter ElevenLabs API Key"
		/>
	</div>
</div>

<!-- Search Section -->
<div class="flex min-h-screen items-center justify-center px-4">
	<div class="w-full max-w-2xl">
		<div class="relative">
			<input
				type="text"
				bind:value={searchQuery}
				class="w-full rounded-full border border-gray-300 px-5 py-3 text-lg shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				placeholder="What can we help you with?"
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<button
				class="absolute top-1/2 right-3 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
				onclick={handleSearch}
				aria-label="Search"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
			</button>
		</div>
	</div>
</div>
