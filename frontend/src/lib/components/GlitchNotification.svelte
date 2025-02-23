<script lang="ts">
	import { fade } from 'svelte/transition';
	import TextScramble from './TextScramble.svelte';
	import { initializeNotifications } from '$lib/stores/notifications';

	type NotificationData = {
		id: string;
		message: string;
		type?: 'info' | 'success' | 'warning' | 'error';
		duration?: number;
	};

	let notifications = $state<NotificationData[]>([]);
	let notificationBuffer = $state<NotificationData[]>([]);
	let isProcessingBuffer = $state(false);
	let lastNotificationTime = $state(0);
	const NOTIFICATION_SPACING = 150; // ms between notifications

	async function processNotificationBuffer() {
		if (isProcessingBuffer || notificationBuffer.length === 0) return;
		isProcessingBuffer = true;

		try {
			while (notificationBuffer.length > 0) {
				const now = Date.now();
				const timeSinceLastNotification = now - lastNotificationTime;

				if (timeSinceLastNotification < NOTIFICATION_SPACING) {
					await new Promise((resolve) =>
						setTimeout(resolve, NOTIFICATION_SPACING - timeSinceLastNotification)
					);
				}

				const notification = notificationBuffer.shift()!;
				notifications = [...notifications, notification];
				lastNotificationTime = Date.now();

				// Remove the notification after its duration
				setTimeout(() => {
					notifications = notifications.filter((n) => n.id !== notification.id);
				}, notification.duration);
			}
		} finally {
			isProcessingBuffer = false;
		}
	}

	// Global function to show notifications
	function showNotification(
		message: string,
		type: 'info' | 'success' | 'warning' | 'error' = 'info',
		duration = 5000
	) {
		const notification = {
			id: Math.random().toString(36).substring(2),
			message,
			type,
			duration
		};

		notificationBuffer = [...notificationBuffer, notification];
		processNotificationBuffer();
	}

	// Initialize the notification system
	$effect(() => {
		initializeNotifications(showNotification);
	});

	function getTypeStyles(type: NotificationData['type']) {
		switch (type) {
			case 'success':
				return 'border-green-500 from-green-500/20';
			case 'warning':
				return 'border-yellow-500 from-yellow-500/20';
			case 'error':
				return 'border-red-500 from-red-500/20';
			default:
				return 'border-[#FF6222] from-[#FF6222]/20';
		}
	}
</script>

<div class="pointer-events-none fixed right-0 bottom-0 z-50 flex max-w-xs flex-col items-end p-2">
	{#each notifications as notification (notification.id)}
		<div
			transition:fade={{ duration: 200 }}
			class="pointer-events-auto mb-1.5 w-full overflow-hidden"
		>
			<div
				class="relative border bg-gradient-to-r from-black to-black/80 text-white backdrop-blur-sm
                     {getTypeStyles(notification.type)}"
			>
				<!-- Scanlines effect -->
				<div class="scanlines pointer-events-none absolute inset-0" />

				<!-- Glitch effect container -->
				<div class="relative px-2 py-1.5">
					<!-- Content -->
					<div class="flex items-center justify-between gap-1.5">
						<div class="flex-1 font-mono text-xs leading-tight">
							<TextScramble text={notification.message} duration={800} />
						</div>
						<button
							class="text-white/50 transition-colors hover:text-white"
							onclick={() => {
								notifications = notifications.filter((n) => n.id !== notification.id);
							}}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3 w-3"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	.scanlines {
		background: linear-gradient(to bottom, transparent 50%, rgba(255, 255, 255, 0.1) 50%);
		background-size: 100% 4px;
		animation: scan 1s linear infinite;
	}

	@keyframes scan {
		from {
			background-position: 0 0;
		}
		to {
			background-position: 0 4px;
		}
	}

	/* Glitch animation */
	.glitch {
		animation: glitch 1s linear infinite;
		animation-direction: alternate-reverse;
	}

	@keyframes glitch {
		0% {
			transform: skew(0deg);
		}
		20% {
			transform: skew(0.5deg);
		}
		40% {
			transform: skew(-0.5deg);
		}
		60% {
			transform: skew(0.25deg);
		}
		80% {
			transform: skew(-0.25deg);
		}
		100% {
			transform: skew(0deg);
		}
	}
</style>
