import type { TimestampedMessage } from '$lib/types/messages';

// Global state for developer events
let developerEvents = $state<TimestampedMessage[]>([]);

// Helper function to add developer events
export function addDeveloperEvent(message: string) {
	developerEvents = [
		...developerEvents,
		{
			role: 'developer',
			content: message,
			timestamp: Date.now(),
			name: 'developer'
		}
	];
}

// Helper function to clear developer events
export function clearDeveloperEvents() {
	developerEvents = [];
}

// Helper functions for AI join/leave events
export function addAiJoinEvent(agent: { name: string; model?: string; personality?: string }) {
	const normalizedName = normalizeAgentName(agent.name);
	const modelInfo = agent.model ? ` (${agent.model})` : '';
	const backstory = agent.personality ? `\nBackstory: ${agent.personality}` : '';
	addDeveloperEvent(`${normalizedName}${modelInfo} joined the conversation${backstory}`);
}

export function addAiLeaveEvent(agent: { name: string; model?: string }) {
	const normalizedName = normalizeAgentName(agent.name);
	const modelInfo = agent.model ? ` (${agent.model})` : '';
	addDeveloperEvent(`${normalizedName}${modelInfo} left the conversation`);
}

// Helper function to normalize agent names
export function normalizeAgentName(name: string | null | undefined): string {
	if (!name) {
		console.error('Agent name is required');
		return 'unknown';
	}
	return name
		.replace(/[^a-zA-Z0-9_-]/g, '_') // Replace invalid chars with underscore
		.replace(/_{2,}/g, '_') // Replace multiple underscores with single
		.replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Get a global chatlog of all messages between agents and users, ordered by timestamp
 * Includes developer events, excludes system messages and tool calls
 * @returns Array of messages with timestamp
 */
export function getGlobalChatlog(
	agents: { getMessageLog: () => TimestampedMessage[] }[]
): TimestampedMessage[] {
	const allowed_roles = ['user', 'assistant', 'developer'];
	const allMessages = [
		...agents.flatMap((agent) =>
			agent
				.getMessageLog()
				.filter((msg) => allowed_roles.includes(msg.role) && msg.content !== null)
				.map((msg) => ({
					...msg,
					name: normalizeAgentName(msg.name)
				}))
		),
		...developerEvents
	];

	// Deduplicate messages based on content, timestamp, and name
	const uniqueMessages = allMessages.filter(
		(message, index, self) =>
			index ===
			self.findIndex(
				(m) =>
					m.content === message.content &&
					m.timestamp === message.timestamp &&
					m.name === message.name
			)
	);

	return uniqueMessages.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Merge messages from multiple sources chronologically
 */
export function mergeMessages(
	systemMessage: TimestampedMessage,
	agentMessages: TimestampedMessage[],
	otherMessages: TimestampedMessage[]
): TimestampedMessage[] {
	const mergedMessages = [systemMessage];
	let agentIndex = 0;
	let otherIndex = 0;

	while (agentIndex < agentMessages.length || otherIndex < otherMessages.length) {
		if (agentIndex >= agentMessages.length) {
			// Add remaining other messages
			mergedMessages.push(otherMessages[otherIndex]);
			otherIndex++;
		} else if (otherIndex >= otherMessages.length) {
			// Add remaining agent messages
			mergedMessages.push(agentMessages[agentIndex]);
			agentIndex++;
		} else {
			// Compare timestamps and add the earlier message
			if (agentMessages[agentIndex].timestamp <= otherMessages[otherIndex].timestamp) {
				mergedMessages.push(agentMessages[agentIndex]);
				agentIndex++;
			} else {
				mergedMessages.push(otherMessages[otherIndex]);
				otherIndex++;
			}
		}
	}

	return mergedMessages;
}
