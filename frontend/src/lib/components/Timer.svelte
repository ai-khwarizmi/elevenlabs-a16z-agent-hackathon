<script lang="ts">
	let {
		startTime
	}: {
		startTime: number | null | undefined;
	} = $props();

	let now = $state(Date.now());
	let secondsSinceStart = $derived(startTime ? Math.floor((now - startTime) / 1000) : 0);

	let minutes = $derived(Math.floor(secondsSinceStart / 60));
	let seconds = $derived(secondsSinceStart % 60);

	let stringTimer = $derived(
		`${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`
	);

	$effect(() => {
		if (!startTime) {
			return;
		}
		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => clearInterval(interval);
	});
</script>

{#if startTime}
	{stringTimer}
{/if}
