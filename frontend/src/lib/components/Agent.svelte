<script lang="ts">
  	import type { Agent, AgentState } from '$lib/utils/agent.svelte';
  	import TextScramble from './TextScramble.svelte';

  const { agent } = $props<{ agent: Agent }>();
  let showPopup = $state(false);
  let showMessages = $state(false);
  let messages = $derived(agent.getMessageLog());

  function togglePopup() {
    showPopup = !showPopup;
    if (!showPopup) showMessages = false;
  }

  let stateClasses = $derived(() => {
    switch (agent.getState()) {
      case 'IDLE':
        return 'bg-gray-100 text-gray-800';
      case 'VOICE_ACTIVE':
        return 'bg-blue-100 text-blue-800';
      case 'LEFT_CALL':
        return 'bg-red-100 text-red-800';
      case 'WORKING':
        return 'bg-yellow-100 text-yellow-800';
      case 'RAISED_HAND':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  });
</script>

<div
  onclick={togglePopup}
  onkeydown={(e) => e.key === 'Enter' && togglePopup()}
  role="button"
  tabindex="0"
  class="flex flex-col justify-center items-center p-5 gap-2 w-full bg-black border border-white cursor-pointer {
    agent.getState() === 'VOICE_ACTIVE' || agent.getState() === 'TEXT_ACTIVE'
      ? 'border-[#FF6222]'
      : agent.getState() === 'IDLE'
      ? 'border-gray-500'
      : agent.getState() === 'WORKING'
      ? 'border-white'
      : 'border-gray-500'
  }"
>
  <div class="flex flex-col justify-center items-center gap-2 w-full ">
    <!-- State text -->
    <span class="font-['Anonymous_Pro'] font-bold text-lg text-center {
      agent.getState() === 'VOICE_ACTIVE' || agent.getState() === 'TEXT_ACTIVE' ? 'text-[#FF6222]' : 'text-white'
    }">
      {agent.getState()}
    </span>

    <!-- Image container -->
    <div class="relative w-full max-w-[179px] aspect-square">
      {#if agent.getProfilePicture()}
        <img
          src={agent.getProfilePicture()}
          alt={agent.getName()}
          class="w-full h-full rounded-full bg-gray-900 object-cover"
        />
      {:else}
        <div class="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
          <span class="text-4xl text-white">{agent.getName()[0].toUpperCase()}</span>
        </div>
      {/if}
      {#if agent.getState() === 'VOICE_ACTIVE' || agent.getState() === 'TEXT_ACTIVE'}
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 aspect-square bg-white rounded-full flex items-center justify-center">
          {#if agent.getState() === 'VOICE_ACTIVE'}
            <div class="audio-wave">
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
            </div>
          {:else}
            <div class="typing-dots">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Agent Info -->
    <div class="w-full text-center">
      <h2 class="font-bold text-2xl text-white">
        {agent.getName()}
      </h2>
      <p class="text-sm text-gray-300 mt-1 line-clamp-2">
        {agent.getPersonality()}
      </p>
    </div>
  </div>
</div>

<!-- Popup overlay -->
{#if showPopup}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    onclick={togglePopup}
    onkeydown={(e) => e.key === 'Enter' && togglePopup()}
    role="button"
    tabindex="0"
  >
    <!-- Popup content -->
    <div
      class="bg-black border border-white p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Enter' && togglePopup()}
      role="button"
      tabindex="0"
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-white">Agent Details</h2>
        <button
          onclick={togglePopup}
          class="text-white"
          onkeydown={(e) => e.key === 'Enter' && togglePopup()}
          tabindex="0"
          aria-label="Close"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Agent info -->
      <div class="flex items-center gap-4 mb-6">
        {#if agent.getProfilePicture()}
          <img
            src={agent.getProfilePicture()}
            alt="{agent.getName()}'s profile"
            class="h-20 w-20 rounded-full object-cover"
          />
        {:else}
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-white">
            <span class="text-3xl text-white">{agent.getName()[0].toUpperCase()}</span>
          </div>
        {/if}
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-medium text-white">{agent.getName()}</h3>
            <div class="min-w-[100px]">
              <TextScramble
                text={agent.getState()}
                class="rounded-full px-3 py-1 text-sm font-medium {stateClasses}"
              />
            </div>
          </div>
          <p class="mt-2 text-white">{agent.getPersonality()}</p>
        </div>
      </div>

      <!-- Tools section -->
      {#if agent.getTools().length > 0}
        <div class="mb-6">
          <h4 class="text-lg font-medium text-white mb-2">Tools</h4>
          <div class="flex flex-wrap gap-2">
            {#each agent.getTools() as tool}
              <span class="bg-white px-3 py-1 text-sm font-medium text-black">
                {tool.getDefinition().function.name}
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Todo list section -->
      {#if agent.getTodos().length > 0}
        <div class="mb-6">
          <h4 class="text-lg font-medium text-white mb-2">Todo List</h4>
          <div class="space-y-2">
            {#each agent.getTodos() as todo}
              <div class="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div>
                  <h5 class="font-medium text-white">{todo.title}</h5>
                  <p class="text-sm text-white">{todo.description}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="rounded-full px-2 py-1 text-xs font-medium"
                    class:bg-red-100={todo.priority === 'high'}
                    class:text-red-800={todo.priority === 'high'}
                    class:bg-yellow-100={todo.priority === 'medium'}
                    class:text-yellow-800={todo.priority === 'medium'}
                    class:bg-green-100={todo.priority === 'low'}
                    class:text-green-800={todo.priority === 'low'}
                  >
                    {todo.priority}
                  </span>
                  <span
                    class="rounded-full px-2 py-1 text-xs font-medium"
                    class:bg-blue-100={todo.status === 'pending'}
                    class:text-blue-800={todo.status === 'pending'}
                    class:bg-purple-100={todo.status === 'in_progress'}
                    class:text-purple-800={todo.status === 'in_progress'}
                    class:bg-green-100={todo.status === 'completed'}
                    class:text-green-800={todo.status === 'completed'}
                  >
                    {todo.status}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Message log section -->
      {#if messages.length > 0}
        <div>
          <button
            onclick={() => (showMessages = !showMessages)}
            class="flex items-center gap-2 text-sm font-medium text-white  mb-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 transition-transform duration-200"
              class:rotate-90={showMessages}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            Message Log ({messages.length})
          </button>

          {#if showMessages}
            <div class="space-y-2">
              {#each messages as message}
                <div class="rounded-lg bg-black p-3">
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center justify-between">
                      <span class="font-medium text-white">{message.role}:</span>
                      <span class="text-xs text-white">
                        {new Date(message.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p class="text-sm text-white">{message.content}</p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .audio-wave {
    display: flex;
    align-items: center;
    gap: clamp(2px, 0.5vw, 4px);
    height: clamp(30px, 5vw, 41px);
  }

  .bar {
    width: clamp(4px, 1vw, 8px);
    height: clamp(15px, 2.5vw, 20px);
    background: #FF6222;
    animation: wave 1s ease-in-out infinite;
  }

  .bar:nth-child(2) {
    animation-delay: 0.1s;
  }

  .bar:nth-child(3) {
    animation-delay: 0.2s;
  }

  .bar:nth-child(4) {
    animation-delay: 0.3s;
  }

  @keyframes wave {
    0%, 10%, 90%, 100% {
      height: clamp(15px, 2.5vw, 20px);
    }
    45%, 55% {
      height: clamp(30px, 5vw, 41px);
    }
  }

  .typing-dots {
    display: flex;
    align-items: center;
    gap: clamp(2px, 0.5vw, 4px);
  }

  .dot {
    width: clamp(4px, 1vw, 8px);
    height: clamp(4px, 1vw, 8px);
    background: #FF6222;
    border-radius: 50%;
    animation: jump 1s ease-in-out infinite;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes jump {
    0%, 10%, 90%, 100% {
      transform: translateY(0);
    }
    45%, 55% {
      transform: translateY(-8px);
    }
  }
</style>
