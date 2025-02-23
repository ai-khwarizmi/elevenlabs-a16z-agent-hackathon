<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import TextScramble from './TextScramble.svelte';
	import {
		initializeNotifications,
		type NotificationType,
		type ProgressNotification
	} from '$lib/stores/notifications';

	type BaseNotificationData = {
		id: string;
		message: string;
		type?: NotificationType;
		duration?: number;
	};

	type StandardNotificationData = BaseNotificationData & {
		isProgress?: false;
	};

	type ProgressNotificationData = BaseNotificationData & {
		isProgress: true;
		progress: number;
		state?: 'active' | 'success' | 'error';
	};

	type NotificationData = StandardNotificationData | ProgressNotificationData;

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

				// Remove the notification after its duration if it's not a progress notification
				if (!('isProgress' in notification) || !notification.isProgress) {
					setTimeout(() => {
						notifications = notifications.filter((n) => n.id !== notification.id);
					}, notification.duration);
				}
			}
		} finally {
			isProcessingBuffer = false;
		}
	}

	// Global function to show notifications
	function showNotification(message: string, type: NotificationType = 'info', duration = 5000) {
		const notification: StandardNotificationData = {
			id: Math.random().toString(36).substring(2),
			message,
			type,
			duration
		};

		notificationBuffer = [...notificationBuffer, notification];
		processNotificationBuffer();
	}

	// Function to create progress notifications
	function createProgressNotification(message: string): ProgressNotification {
		const id = Math.random().toString(36).substring(2);
		const notification: ProgressNotificationData = {
			id,
			message,
			isProgress: true,
			progress: 0,
			state: 'active'
		};

		notificationBuffer = [...notificationBuffer, notification];
		processNotificationBuffer();

		return {
			id,
			message,
			progress: 0,
			updateProgress: (progress: number) => {
				notifications = notifications.map((n) => {
					if (n.id === id && 'isProgress' in n && n.isProgress) {
						return { ...n, progress: Math.min(100, Math.max(0, progress)) };
					}
					return n;
				});
			},
			finish: (type?: 'success' | 'error') => {
				if (!type) {
					notifications = notifications.filter((n) => n.id !== id);
					return;
				}

				notifications = notifications.map((n) => {
					if (n.id === id && 'isProgress' in n && n.isProgress) {
						return {
							...n,
							state: type,
							progress: 100
						};
					}
					return n;
				});

				// Remove after a short delay to show the success/error state
				setTimeout(() => {
					notifications = notifications.filter((n) => n.id !== id);
				}, 1000);
			}
		};
	}

	// Initialize the notification system
	$effect(() => {
		initializeNotifications(showNotification, createProgressNotification);
	});

	function getTypeStyles(notification: NotificationData) {
		if ('isProgress' in notification && notification.isProgress) {
			if (notification.state === 'success') return 'border-green-500 from-green-500/20';
			if (notification.state === 'error') return 'border-red-500 from-red-500/20';
			return 'border-blue-500 from-blue-500/20';
		}

		switch (notification.type) {
			case 'success':
				return 'border-green-500 from-green-500/20';
			case 'warning':
				return 'border-yellow-500 from-yellow-500/20';
			case 'error':
				return 'border-red-500 from-red-500/20';
			default:
				return 'border-white/20 from-white/10';
		}
	}
</script>

<div class="pointer-events-none fixed right-0 bottom-0 z-50 flex max-w-xs flex-col items-end pr-4 pb-4">
	{#each notifications as notification (notification.id)}
		<div
			transition:fade={{ duration: 200 }}
			class="pointer-events-auto mb-1.5 w-full overflow-hidden"
		>
			<div
				class="relative border bg-gradient-to-r from-black to-black/80 text-white backdrop-blur-sm p-2
                     {getTypeStyles(notification)}"
			>
				<!-- Scanlines effect -->
				<div class="scanlines pointer-events-none absolute inset-0" />

				<!-- Progress bar for progress notifications -->
				{#if 'isProgress' in notification && notification.isProgress}
					<div class="absolute bottom-0 left-0 h-0.5 w-full bg-black/20">
						<div
							class="h-full bg-current transition-all duration-300"
							style="width: {notification.progress}%"
						/>
					</div>
				{/if}

				<!-- Glitch effect container -->
				<div class="relative px-2 py-1.5">
					<!-- Content -->
					<div class="flex items-center justify-between gap-1.5">
						<div class="flex-1 font-mono text-sm leading-tight">
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
