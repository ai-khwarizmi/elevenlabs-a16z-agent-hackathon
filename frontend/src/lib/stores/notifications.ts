export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type ProgressNotification = {
	id: string;
	message: string;
	progress: number;
	updateProgress: (progress: number) => void;
	finish: (type?: 'success' | 'error') => void;
};

// Make the function mutable by storing it in a variable
let notificationFunction = (message: string, type: NotificationType = 'info', duration = 5000) => {
	console.warn(
		`Notification system not initialized. Tried to show: ${message} (${type}, ${duration}ms)`
	);
};

let createProgressNotificationFunction = (message: string): ProgressNotification => {
	console.warn(`Progress notification system not initialized. Tried to create: ${message}`);
	return {
		id: '',
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
	return createProgressNotificationFunction(message);
};

// This will be called by GlitchNotification to set up the actual notification functions
export function initializeNotifications(
	notifyFn: typeof notificationFunction,
	createProgressFn: typeof createProgressNotificationFunction
) {
	notificationFunction = notifyFn;
	createProgressNotificationFunction = createProgressFn;
}
