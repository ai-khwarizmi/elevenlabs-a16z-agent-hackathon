<script lang="ts">
	import { getStoredKeys } from '$lib/storage/keys';
	import { agents } from '$lib/stores/agents.svelte';
	import { showApiKeysPopup } from '$lib/stores/apiKeys';
	import Logo from '$lib/components/Logo.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import HangUpIcon from '$lib/assets/icons/hangup.svg';
	import MicIcon from '$lib/assets/icons/mic.svg';
	import Agent from '$lib/components/Agent.svelte';
	import ChatTranscript from '$lib/components/ChatTranscript.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import { sessions } from '$lib/stores/agents.svelte';
	import ApiKeyInputs from '$lib/components/ApiKeyInputs.svelte';
	import Dots from '$lib/assets/icons/dots.svg';
	import { PROJECT_NAME } from '$lib/constants';

	let message = $state('');
	let isProcessing = $state(false);
	let response = $state('');
	let responseAgentName = $state('');
	let error = $state('');
	let isTranscriptExpanded = $state(false);
	let apiKeysNotSet = $state(true);
	let currentAgents = $derived(agents.list);

	let activeAgent = $derived(currentAgents.find((agent) => agent.getState() === 'ACTIVE'));

	// Load keys from localStorage on mount
	$effect(() => {
		const {
			openaiKey: storedOpenAIKey,
			elevenLabsKey: storedElevenLabsKey,
			falKey: storedFalKey
		} = getStoredKeys();
		apiKeysNotSet = !storedOpenAIKey || !storedElevenLabsKey || !storedFalKey;
	});

	async function handleMessage() {
		if (!message.trim()) return;

		response = message;
		responseAgentName = 'User';

		const messageCopy = message.trim();
		message = '';
		//get agent
		const agent = currentAgents.find((agent) => agent.getState() === 'ACTIVE');

		if (!agent) {
			error = 'No active agent found';
			console.error('No active agent found');
			return;
		}

		const { openaiKey } = getStoredKeys();
		if (!openaiKey) {
			error = 'Please enter your OpenAI API key first';
			return;
		}

		isProcessing = true;
		error = '';

		try {
			response = await agent.chat(messageCopy);
			responseAgentName = agent.getName();
		} catch (err) {
			message = '';
			error = 'Failed to process your request';
			console.error(err);
		} finally {
			isProcessing = false;
		}
	}

	function handleCreateSession() {
		sessions.createDefaultSession();
	}

	function handleKeysUpdated(event: CustomEvent<{ keysSet: boolean }>) {
		apiKeysNotSet = !event.detail.keysSet;
	}
</script>

<svelte:head>
	<title>{PROJECT_NAME}</title>
	<link
		href="https://fonts.googleapis.com/css2?family=Anonymous+Pro:wght@400;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<ChatTranscript bind:isExpanded={isTranscriptExpanded} showButton={agents.list.length > 0} />
<ApiKeyInputs on:keysUpdated={handleKeysUpdated} />

<div
	class="p-8 transition-[padding] duration-300"
	class:pr-96={isTranscriptExpanded}
	style="background-image: url({Dots}); background-repeat: repeat;"
>
	<div class=" text-white">
		{#if currentAgents.length === 0}
			<main class="flex min-h-[calc(100vh-200px)] items-center justify-center">
				<div class="flex w-full max-w-3xl flex-col items-center gap-12">
					<div class="flex flex-col items-center gap-6 text-center">
						<div>
							<Logo size="large" />
						</div>
						<p class="max-w-xl text-lg text-gray-400">
							Your AI roundtable of experts collaborating to solve complex challenges
						</p>
					</div>

					{#if apiKeysNotSet}
						<div
							class="flex flex-col items-center gap-6 rounded-lg border border-gray-800 bg-gray-900/50 p-8"
						>
							<div class="flex flex-col items-center gap-4">
								<h2 class="text-xl font-semibold">How It Works</h2>
								<div class="space-y-4 text-left">
									<p class="text-gray-300">
										🤝 Present your challenge or question, and our AI agents will collaborate to
										help you find the best solution.
									</p>
									<ul class="list-disc space-y-2 pl-5 text-gray-300">
										<li>Each agent has unique expertise and specializations</li>
										<li>
											The Chief of Staff will coordinate and bring in the most suitable agents for
											your needs
										</li>
										<li>Agents can dynamically add other experts to the conversation</li>
										<li>Get help with problem-solving, document creation, analysis, and more</li>
									</ul>

									<div class="mt-4 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
										<h3 class="mb-2 font-semibold text-gray-200">Example Prompts:</h3>
										<ul class="space-y-2 text-gray-300">
											<li>
												🎯 "I need to organize a corporate retreat for 100 people next month. Budget
												is $50k, location needs to be within 2 hours of NYC, and team building is a
												priority. Please help me plan this."
											</li>
											<li>
												📝 "I'm launching a sustainable fashion marketplace. Need a business
												proposal including market analysis, financial projections for 3 years, and
												go-to-market strategy."
											</li>
											<li>
												🔍 "Here's our Q4 sales data showing a 15% decline in our midwest region.
												Please analyze potential causes and recommend solutions."
											</li>
											<li>
												🎨 "We're launching a new plant-based protein drink targeting fitness
												enthusiasts aged 25-40. Budget is $100k. Need a full marketing strategy
												including social media, influencer partnerships, and launch event."
											</li>
										</ul>
										<p class="mt-4 text-sm text-gray-400">
											💡 <strong>Pro tip:</strong> The more detailed information you provide upfront,
											the better the agents can assist you. Include relevant context like budgets, timelines,
											constraints, and specific goals.
										</p>
									</div>

									<div class="mt-6 rounded-lg border border-yellow-600 bg-yellow-900/30 p-4">
										<p class="text-yellow-200">
											⚠️ <strong>Important:</strong> Running these AI agents involves significant OpenAI
											API usage. Please be aware that extended conversations can result in substantial
											API costs.
										</p>
									</div>
								</div>
							</div>
							<AppButton
								text="Continue to API Setup"
								variant="primary"
								onClick={() => showApiKeysPopup()}
							/>
						</div>
					{:else}
						<div
							class="flex flex-col items-center gap-6 rounded-lg border border-green-800 bg-green-900/50 p-8"
						>
							<div class="flex flex-col items-center gap-2">
								<h2 class="text-xl font-semibold">Ready to Begin</h2>
								<p class="text-sm text-gray-400">Start your first session with our AI agents</p>
							</div>
							<AppButton text="Start Session" variant="primary" onClick={handleCreateSession} />
						</div>
					{/if}
				</div>
			</main>
		{:else}
			<!-- Agents Display Section -->
			<div class="h-screen">
				<!-- Grid layout that adapts based on number of participants -->
				<div
					class={`mx-auto grid h-3/4 max-w-5xl gap-4 ${
						currentAgents.length === 1
							? 'place-items-center'
							: currentAgents.length === 2
								? 'grid-cols-2'
								: currentAgents.length === 3
									? 'grid-cols-2 md:grid-cols-3'
									: currentAgents.length === 4
										? 'grid-cols-2'
										: 'grid-cols-2 md:grid-cols-3'
					}`}
				>
					{#each [...currentAgents].sort((a, b) => {
						if (a.getState() === 'ACTIVE') return -1;
						if (b.getState() === 'ACTIVE') return 1;
						return 0;
					}) as agent}
						<div
							class={`relative h-full max-h-[900px] ${currentAgents.length === 1 ? 'aspect-video w-full max-w-4xl' : ''}`}
						>
							<div
								class="absolute inset-0 border-3 transition-colors duration-300"
								class:border-[#FF6222]={agent.getState() === 'ACTIVE' || agent.isSpeakingNow()}
								class:border-gray-800={agent.getState() !== 'ACTIVE' && !agent.isSpeakingNow()}
							>
								<Agent {agent} />

								<!-- Speaking indicator -->
								{#if agent.isSpeakingNow()}
									<div
										class="absolute top-2 right-2 flex items-center gap-2 rounded-full bg-[#FF6222] px-3 py-1"
									>
										<div class="h-2 w-2 animate-pulse rounded-full bg-white"></div>
										<span class="text-sm text-white">Speaking</span>
									</div>
								{:else}
									<!-- Connection status -->
									<div class="absolute top-2 right-2 flex items-center gap-2">
										<div
											class="flex items-center gap-2 rounded-full bg-black/30 px-2 py-1 text-sm text-white"
										>
											<div
												class="h-2 w-2 rounded-full {agent.getState() === 'ACTIVE'
													? 'bg-green-500'
													: 'bg-gray-300'}"
											></div>
											<span>{agent.getState() === 'ACTIVE' ? 'Connected' : 'Idle'}</span>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Controls overlay at the bottom -->
			<div class="absolute right-0 bottom-0 left-0 z-10 h-24">
				<div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4">
					{#if agents.mode === 'VOICE'}
						{#if activeAgent?.getCallStartTime()}
							<div class="rounded-full border border-white bg-black px-4 py-2 backdrop-blur-sm">
								<Timer startTime={activeAgent.getCallStartTime()} />
							</div>
						{/if}
						{#if activeAgent?.getIsConnectedToConversation()}
							<AppButton
								text="End Call"
								variant="destructive"
								icon={HangUpIcon}
								onClick={() => (agents.mode = 'TEXT')}
							/>
						{:else}
							<AppButton text="Connecting..." variant="primary" icon={MicIcon} disabled={true} />
						{/if}
					{:else}
						<AppButton
							text="Join Call"
							variant="success"
							icon={MicIcon}
							onClick={() => (agents.mode = 'VOICE')}
						/>
					{/if}
				</div>
			</div>

			<!-- Search and Controls Section -->
			<div class="mx-auto w-full max-w-2xl items-end justify-center space-y-4">
				{#if response}
					<div class="relative border border-white bg-black p-4 text-white">
						<button
							class="absolute top-2 right-2 text-sm text-white/50 hover:text-white"
							onclick={() => (response = '')}
						>
							dismiss
						</button>
						<h3 class="mb-1 text-sm text-[#FF6222]">{responseAgentName}:</h3>
						{response}
					</div>
				{/if}

				{#if error}
					<div class="rounded-md bg-red-50 p-4 text-sm text-red-700">
						{error}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
