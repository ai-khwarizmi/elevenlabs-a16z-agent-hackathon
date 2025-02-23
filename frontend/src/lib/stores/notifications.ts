type NotificationType = 'info' | 'success' | 'warning' | 'error';

// Make the function mutable by storing it in a variable
let notificationFunction = (message: string, type: NotificationType = 'info', duration = 5000) => {
	console.warn(
		`Notification system not initialized. Tried to show: ${message} (${type}, ${duration}ms)`
	);
};

export const showNotification = (
	message: string,
	type: NotificationType = 'info',
	duration = 5000
) => {
	notificationFunction(message, type, duration);
};

// This will be called by GlitchNotification to set up the actual notification function
export function initializeNotifications(notifyFn: typeof notificationFunction) {
	notificationFunction = notifyFn;
}
