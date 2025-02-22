<script lang="ts">
  	import type { Agent } from '$lib/utils/agent.svelte';

  export let agent: Agent;
  export let state: 'speaking' | 'idle' | 'researching' | 'error' | 'unknown';
</script>

<div class="flex flex-col justify-center items-center p-5 gap-2 w-full bg-black border {state === 'speaking' ? 'border-[#FF6222]' : state === 'idle' ? 'border-gray-500' : 'border-white'}">
  <div class="flex flex-col justify-center items-center gap-2 w-full ">
    <!-- State text -->
    <span class="font-['Anonymous_Pro'] font-bold text-lg text-center {state === 'speaking' ? 'text-[#FF6222]' : 'text-white'}">
      {state}
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
      {#if state === 'speaking'}
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 aspect-square bg-white rounded-full flex items-center justify-center">
          <div class="audio-wave">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Agent Info -->
    <div class="w-full text-center">
      <h2 class="font-bold text-2xl text-white">
        {agent.getName()}
      </h2>
      <p class="text-sm text-gray-400 mt-1 line-clamp-2">
        {agent.getPersonality()}
      </p>
    </div>
  </div>
</div>

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
    0%, 100% {
      height: clamp(15px, 2.5vw, 20px);
    }
    50% {
      height: clamp(30px, 5vw, 41px);
    }
  }
</style>
