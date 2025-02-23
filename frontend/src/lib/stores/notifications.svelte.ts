export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type ProgressNotification = {
	id: string;
	message: string;
	progress: number;
	updateProgress: (progress: number) => void;
	finish: (type?: 'success' | 'error') => void;
};

// Track active progress notifications
const activeProgressNotifications = $state.raw<
	Record<
		string,
		{
			message: string;
			progress: number;
			lastUpdate: number;
		}
	>
>({});

// Cleanup stale notifications every 5 minutes
const STALE_NOTIFICATION_TIMEOUT = 5 * 60 * 1000;
setInterval(() => {
	const now = Date.now();
	for (const [id, notification] of Object.entries(activeProgressNotifications)) {
		if (now - notification.lastUpdate > STALE_NOTIFICATION_TIMEOUT) {
			delete activeProgressNotifications[id];
		}
	}
}, 60000);

// Default notification functions that will be replaced during initialization
let notificationFunction = (message: string, type: NotificationType = 'info', duration = 5000) => {
	console.warn('Notification system not initialized:', { message, type, duration });
};

let createProgressNotificationFunction = (message: string): ProgressNotification => {
	console.warn('Progress notification system not initialized:', message);
	return {
		id: crypto.randomUUID(),
		message,
		progress: 0,
		updateProgress: () => {},
		finish: () => {}
	};
};

export const showNotification = (
	message: string,
	type: NotificationType = 'info',
	duration = 3000
) => {
	notificationFunction(message, type, duration);
};

export const createProgressNotification = (message: string): ProgressNotification => {
	const id = crypto.randomUUID();
	const notification = createProgressNotificationFunction(message);

	// Ensure we're using our generated ID
	notification.id = id;

	// Initialize tracking state
	activeProgressNotifications[id] = {
		message,
		progress: 0,
		lastUpdate: Date.now()
	};

	// Wrap the functions to track state
	const originalUpdateProgress = notification.updateProgress;
	notification.updateProgress = (progress: number) => {
		if (activeProgressNotifications[id]) {
			activeProgressNotifications[id].progress = progress;
			activeProgressNotifications[id].lastUpdate = Date.now();
			originalUpdateProgress(progress);
		}
	};

	const originalFinish = notification.finish;
	notification.finish = (type?: 'success' | 'error') => {
		if (!activeProgressNotifications[id]) {
			console.warn('Attempted to finish an already completed or non-existent notification:', id);
			return;
		}
		delete activeProgressNotifications[id];
		originalFinish(type);
	};

	return notification;
};

export function initializeNotifications(
	notifyFn: typeof notificationFunction,
	createProgressFn: typeof createProgressNotificationFunction
) {
	if (notifyFn) notificationFunction = notifyFn;
	if (createProgressFn) createProgressNotificationFunction = createProgressFn;
}
