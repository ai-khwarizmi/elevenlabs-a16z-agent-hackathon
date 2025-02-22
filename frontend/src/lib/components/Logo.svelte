<script lang="ts">
  export let size: 'small' | 'large' = 'large';
</script>

<div class={`font-mono ${size === 'small' ? 'text-2xl' : 'text-6xl'} flex gap-2 items-center`}>
  <span class="text-white">Project</span>
  <span class="text-[#FF6222]">WarRoom.</span>
</div>
