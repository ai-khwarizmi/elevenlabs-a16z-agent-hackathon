<script lang="ts">
  import { sessions } from '$lib/stores/agents.svelte';
  import ApiKeyInputs from './ApiKeyInputs.svelte';
	import Logo from './Logo.svelte';

  let { isTranscriptExpanded = $bindable(true) } = $props();
  let sessionList = $derived(sessions.list);
  let currentSession = $derived(sessions.current);

	function handleSessionChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		sessions.loadSession(select.value);
	}

	function handleCreateSession() {
		const sessionNumber = sessionList.length + 1;
		sessions.createSession(`Session ${sessionNumber}`);
	}
</script>

<nav class="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-8 py-4 bg-black" class:pr-[calc(384px+2rem)]={isTranscriptExpanded}>
  <div class="flex items-center justify-between gap-8">
    <Logo size="small" />
    <a 
      href="/" 
      class="font-['Anonymous_Pro'] text-white text-base opacity-70 hover:opacity-100 transition-opacity duration-200 ease-in-out"
    >
      Home
    </a>
    <a 
      href="/about" 
      class="font-['Anonymous_Pro'] text-white text-base opacity-70 hover:opacity-100 transition-opacity duration-200 ease-in-out"
    >
      About
    </a>
  </div>

  <div class="flex items-center gap-2">
    <ApiKeyInputs />

    <select
      value={currentSession?.id}
      onchange={handleSessionChange}
      class="bg-black border border-white text-white px-3 py-2.5 text-sm font-['Anonymous_Pro'] focus:outline-none focus:border-[#FF6222] transition-all duration-200 box-border"
    >
      {#each sessionList as session}
        <option value={session.id}>{session.name}</option>
      {/each}
    </select>

    <button
      onclick={handleCreateSession}
      class="bg-black border border-white text-white px-3 py-2 text-sm font-['Anonymous_Pro'] hover:border-[#FF6222] transition-all duration-200"
    >
      New Session
    </button>
  </div>
</nav>
