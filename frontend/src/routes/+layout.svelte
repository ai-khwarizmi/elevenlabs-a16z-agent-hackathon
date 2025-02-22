<script lang="ts">
	import '../app.css';
	let { children } = $props();

	let executionTime = $state(0);

	$effect(() => {
		let timeoutId: any;

		function tick() {
			const start = performance.now();

			executionTime = performance.now() - start;
			timeoutId = setTimeout(tick, 1000);
		}

		tick();
		return () => clearTimeout(timeoutId);
	});
</script>

<div class="fixed right-2 bottom-2 font-mono text-sm">
	Task took: {executionTime.toFixed(1)}ms
</div>

{@render children()}
