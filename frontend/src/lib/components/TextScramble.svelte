<script lang="ts">
	const chars = '!<>-_\\/[]{}—=+*^?#________';
	const MAX_WINDOW_SIZE = 20; // Maximum characters animating at once
	const MIN_WINDOW_SIZE = 1; // Minimum characters animating at once

	let { text = '', duration = $bindable(800), class: className = '' } = $props();
	let displayText = $state('');
	let isAnimating = $state(false);
	let startTime = $state(0);
	let frame: number;
	let currentText = '';

	type QueueItem = {
		from: string;
		to: string;
		index: number;
	};

	let queue: QueueItem[] = [];

	$effect(() => {
		// Only start animation when text actually changes
		if (text !== currentText && !isAnimating) {
			currentText = text;
			startNewAnimation();
		}
	});

	function startNewAnimation() {
		// Clear any existing animation
		if (frame) {
			cancelAnimationFrame(frame);
		}

		const oldText = displayText || '';
		const newText = text;
		const maxLength = Math.max(oldText.length, newText.length);

		// Build queue of characters that need to change
		queue = [];
		for (let i = 0; i < maxLength; i++) {
			const oldChar = oldText[i] || ' ';
			const newChar = newText[i] || ' ';
			if (oldChar !== newChar) {
				queue.push({
					from: oldChar,
					to: newChar,
					index: i
				});
			}
		}

		if (queue.length > 0) {
			isAnimating = true;
			startTime = Date.now();
			displayText = oldText || ' '.repeat(maxLength);
			requestAnimationFrame(update);
		} else {
			displayText = newText;
		}
	}

	function update() {
		const now = Date.now();
		const elapsed = now - startTime;
		const progress = Math.min(1, elapsed / duration);

		let result = text.split('');
		let stillAnimating = false;

		// Use a window size proportional to text length, but with minimum and maximum bounds
		const windowSize = Math.max(
			MIN_WINDOW_SIZE,
			Math.min(MAX_WINDOW_SIZE, Math.ceil(queue.length / 2))
		);

		// Calculate the center of the active window, scaled to text length
		const scaledProgress = Math.max(0, Math.min(1, progress * 1.2 - 0.1)); // Add slight delay at start and end
		const windowCenter = Math.floor(scaledProgress * (queue.length + windowSize));

		for (let i = 0; i < queue.length; i++) {
			const item = queue[i];
			const distanceFromCenter = Math.abs(i - windowCenter);

			if (distanceFromCenter < windowSize) {
				stillAnimating = true;
				const charProgress = Math.max(0, Math.min(1, 1 - distanceFromCenter / windowSize));

				if (Math.random() < charProgress) {
					result[item.index] = item.to;
				} else {
					result[item.index] = chars[Math.floor(Math.random() * chars.length)];
				}
			} else if (i < windowCenter - windowSize) {
				result[item.index] = item.to;
			} else {
				result[item.index] = item.from;
			}
		}

		displayText = result.join('');

		if (stillAnimating && progress < 1) {
			frame = requestAnimationFrame(update);
		} else {
			isAnimating = false;
			displayText = text;
		}
	}

	// Cleanup on component destroy
	$effect.pre(() => {
		return () => {
			if (frame) {
				cancelAnimationFrame(frame);
			}
		};
	});
</script>

<div class="relative inline-block font-mono whitespace-pre-wrap">
	<!-- The invisible text that maintains layout -->
	<span class="invisible">{text}</span>
	<!-- The animated scramble text -->
	<span class="{className} absolute inset-0">{displayText}</span>
</div>
