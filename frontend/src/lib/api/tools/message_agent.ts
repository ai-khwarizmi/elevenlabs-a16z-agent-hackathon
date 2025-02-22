import { Tool, type ToolExecuteFunction } from '$lib/api/agent.svelte';
import { agentManager } from '$lib/stores/agents.svelte';

/**
 * Tool for sending messages between agents
 */
export const messageTool = new Tool(
	{
		name: 'message_agent',
		description: 'Send a message to another agent in the conversation',
		parameters: {
			type: 'object',
			properties: {
				to: {
					name: 'to',
					description: 'Name of the agent to send the message to',
					type: 'string'
				},
				message: {
					name: 'message',
					description: 'Content of the message to send',
					type: 'string'
				}
			},
			required: ['to', 'message']
		}
	},
	(async (args) => {
		if (typeof args !== 'object' || args === null) {
			return {
				success: false,
				message: 'Invalid arguments'
			};
		}

		if (typeof args.to !== 'string' || typeof args.message !== 'string') {
			return {
				success: false,
				message: 'Invalid arguments'
			};
		}

		const { to, message } = args;

		// Check if the target agent exists
		const targetAgent = agentManager.getAgent(to);
		if (!targetAgent) {
			return {
				success: false,
				message: `Agent "${to}" not found`
			};
		}

		// Send message to target agent by adding it to their message log
		await targetAgent.chat(message);

		return {
			success: true,
			message: `Message sent to ${to}`,
			sentMessage: message
		};
	}) satisfies ToolExecuteFunction
);
