<script lang="ts">
  export let onSearch: (query: string) => void = () => {};
  export let value = "";
  export let placeholder = "How can we help you today?";
</script>

<div class="relative w-full max-w-[600px] mx-auto">
  <input
    type="text"
    {placeholder}
    bind:value
    on:keydown={(e) => e.key === 'Enter' && onSearch(value)}
    class="w-full p-4 pr-16 bg-black border border-white text-white font-['Anonymous_Pro'] text-base placeholder-white/50 focus:outline-none focus:border-[#FF6222]"
  />
</div>
