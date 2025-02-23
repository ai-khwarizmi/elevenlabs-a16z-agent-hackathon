export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type ProgressNotification = {
	id: string;
	message: string;
	progress: number;
	updateProgress: (progress: number) => void;
	finish: (type?: 'success' | 'error') => void;
};

// Track active progress notifications
const activeProgressNotifications: Record<
	string,
	{
		createdAt: number;
		lastUpdate: number;
		message: string;
		progress: number;
	}
> = {};

// Cleanup stale notifications every minute
const STALE_NOTIFICATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
	const now = Date.now();
	for (const [id, notification] of Object.entries(activeProgressNotifications)) {
		if (now - notification.lastUpdate > STALE_NOTIFICATION_TIMEOUT) {
			console.warn('[Notifications Debug] Found stale notification:', {
				id,
				notification,
				timeSinceLastUpdate: now - notification.lastUpdate
			});
			delete activeProgressNotifications[id];
		}
	}
}, 60000);

// Make the function mutable by storing it in a variable
let notificationFunction = (message: string, type: NotificationType = 'info', duration = 5000) => {
	console.warn(
		`[Notifications Debug] System not initialized. Tried to show: ${message} (${type}, ${duration}ms)`
	);
};

let createProgressNotificationFunction = (message: string): ProgressNotification => {
	console.warn(
		`[Notifications Debug] Progress system not initialized. Tried to create: ${message}`
	);
	const id = crypto.randomUUID();
	return {
		id,
		message,
		progress: 0,
		updateProgress: () => {
			console.warn(
				'[Notifications Debug] Attempted to update progress on uninitialized notification'
			);
		},
		finish: () => {
			console.warn('[Notifications Debug] Attempted to finish uninitialized notification');
		}
	};
};

export const showNotification = (
	message: string,
	type: NotificationType = 'info',
	duration = 3000
) => {
	console.log('[Notifications Debug] Showing notification:', {
		message,
		type,
		duration,
		isInitialized: notificationFunction !== undefined,
		stack: new Error().stack
	});
	try {
		notificationFunction(message, type, duration);
	} catch (error) {
		console.error('[Notifications Debug] Error showing notification:', error);
		throw error;
	}
};

export const createProgressNotification = (message: string): ProgressNotification => {
	const id = crypto.randomUUID();
	console.log('[Notifications Debug] Creating progress notification:', {
		id,
		message,
		isInitialized: createProgressNotificationFunction !== undefined,
		activeNotifications: Object.keys(activeProgressNotifications).length,
		stack: new Error().stack
	});

	try {
		const notification = createProgressNotificationFunction(message);

		// Ensure we're using our generated ID, not any other ID that might have been created
		notification.id = id;

		const now = Date.now();

		// Track this notification
		activeProgressNotifications[id] = {
			createdAt: now,
			lastUpdate: now,
			message,
			progress: 0
		};

		// Wrap the updateProgress and finish functions to track state
		const originalUpdateProgress = notification.updateProgress;
		notification.updateProgress = (progress: number) => {
			if (!activeProgressNotifications[id]) {
				console.error('[Notifications Debug] Trying to update non-existent notification:', {
					id,
					message,
					progress,
					activeNotifications: Object.keys(activeProgressNotifications)
				});
				return;
			}

			console.log('[Notifications Debug] Updating progress:', {
				id,
				message,
				progress,
				timeSinceCreation: Date.now() - activeProgressNotifications[id].createdAt
			});
			activeProgressNotifications[id].lastUpdate = Date.now();
			activeProgressNotifications[id].progress = progress;
			try {
				originalUpdateProgress(progress);
			} catch (error) {
				console.error('[Notifications Debug] Error in updateProgress:', {
					error,
					id,
					message,
					progress
				});
			}
		};

		const originalFinish = notification.finish;
		notification.finish = (type?: 'success' | 'error') => {
			if (!activeProgressNotifications[id]) {
				console.error('[Notifications Debug] Trying to finish non-existent notification:', {
					id,
					message,
					type,
					activeNotifications: Object.keys(activeProgressNotifications)
				});
				return;
			}

			console.log('[Notifications Debug] Finishing notification:', {
				id,
				message,
				type,
				finalProgress: activeProgressNotifications[id]?.progress,
				timeToComplete: Date.now() - activeProgressNotifications[id].createdAt
			});
			delete activeProgressNotifications[id];
			try {
				originalFinish(type);
			} catch (error) {
				console.error('[Notifications Debug] Error in finish:', {
					error,
					id,
					message,
					type
				});
			}
		};

		console.log('[Notifications Debug] Created progress notification:', {
			id,
			notification,
			activeNotifications: Object.keys(activeProgressNotifications)
		});
		return notification;
	} catch (error) {
		console.error('[Notifications Debug] Error creating progress notification:', {
			error,
			message,
			id,
			stack: error instanceof Error ? error.stack : undefined
		});
		throw error;
	}
};

// This will be called by GlitchNotification to set up the actual notification functions
export function initializeNotifications(
	notifyFn: typeof notificationFunction,
	createProgressFn: typeof createProgressNotificationFunction
) {
	console.log('[Notifications Debug] Initializing notification system', {
		existingNotifications: Object.keys(activeProgressNotifications).length,
		stack: new Error().stack
	});
	try {
		if (!notifyFn) {
			console.error('[Notifications Debug] notifyFn is undefined/null');
		}
		if (!createProgressFn) {
			console.error('[Notifications Debug] createProgressFn is undefined/null');
		}
		notificationFunction = notifyFn;
		createProgressNotificationFunction = createProgressFn;
		console.log('[Notifications Debug] Notification system initialized successfully');
	} catch (error) {
		console.error('[Notifications Debug] Error initializing notification system:', error);
		throw error;
	}
}
