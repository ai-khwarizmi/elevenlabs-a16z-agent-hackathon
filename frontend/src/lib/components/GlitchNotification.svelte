<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onDestroy } from 'svelte';
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
		removeAfter?: number; // Timestamp when to remove the notification
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
	const NOTIFICATION_SPACING = 150; // ms between notifications

	// Process notifications in batches to prevent too many updates
	async function processNotifications() {
		if (isProcessingBuffer) return;
		isProcessingBuffer = true;

		try {
			// Process buffer
			if (notificationBuffer.length > 0) {
				const now = Date.now();
				notifications = [...notifications, ...notificationBuffer];
				notificationBuffer = [];
			}

			// Clean up expired notifications in the same batch
			notifications = notifications.filter((n) => !n.removeAfter || n.removeAfter > Date.now());
		} finally {
			isProcessingBuffer = false;
		}
	}

	// Set up periodic cleanup with a reasonable interval
	const processInterval = setInterval(processNotifications, 1000);
	onDestroy(() => clearInterval(processInterval));

	// Global function to show notifications
	function showNotification(message: string, type: NotificationType = 'info', duration = 5000) {
		const notification: StandardNotificationData = {
			id: crypto.randomUUID(),
			message,
			type,
			duration,
			removeAfter: Date.now() + duration
		};

		notificationBuffer = [...notificationBuffer, notification];
	}

	// Function to create progress notifications
	function createProgressNotification(message: string): ProgressNotification {
		const id = crypto.randomUUID();
		const notification: ProgressNotificationData = {
			id,
			message,
			isProgress: true,
			progress: 0,
			state: 'active'
		};

		notificationBuffer = [...notificationBuffer, notification];

		const updateState = (updater: (notifications: NotificationData[]) => NotificationData[]) => {
			try {
				const currentNotifications = notifications;
				const updatedNotifications = updater(currentNotifications);
				if (JSON.stringify(currentNotifications) !== JSON.stringify(updatedNotifications)) {
					notifications = updatedNotifications;
				}
			} catch (error) {
				console.error('[Notification] Error updating state:', error);
				notifications = notifications.filter((n) => n.id !== id);
			}
		};

		return {
			id,
			message,
			progress: 0,
			updateProgress: (progress: number) => {
				updateState((notifications) =>
					notifications.map((n) => {
						if (n.id === id && 'isProgress' in n && n.isProgress) {
							return { ...n, progress: Math.min(100, Math.max(0, progress)) };
						}
						return n;
					})
				);
			},
			finish: (type?: 'success' | 'error') => {
				if (!type) {
					updateState((notifications) => notifications.filter((n) => n.id !== id));
					return;
				}

				updateState((notifications) =>
					notifications.map((n) => {
						if (n.id === id && 'isProgress' in n && n.isProgress) {
							return {
								...n,
								state: type,
								progress: 100,
								removeAfter: Date.now() + 1000
							};
						}
						return n;
					})
				);
			}
		};
	}

	// Initialize the notification system once
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

<div class="pointer-events-none fixed right-0 bottom-0 z-50 flex max-w-xs flex-col items-end p-2">
	{#each notifications as notification (notification.id)}
		<div
			transition:fade={{ duration: 200 }}
			class="pointer-events-auto mb-1.5 w-full overflow-hidden"
		>
			<div
				class="relative border bg-gradient-to-r from-black to-black/80 text-white backdrop-blur-sm
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
