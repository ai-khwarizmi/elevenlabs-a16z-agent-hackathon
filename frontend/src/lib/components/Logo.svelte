<script lang="ts">
	import { PROJECT_NAME } from '$lib/constants';
	export let size: 'small' | 'large' = 'large';
</script>

<div class={`font-mono ${size === 'small' ? 'text-2xl' : 'text-6xl'} flex items-center gap-2`}>
	<span class="text-[#FF6222]">{PROJECT_NAME}.</span>
</div>
