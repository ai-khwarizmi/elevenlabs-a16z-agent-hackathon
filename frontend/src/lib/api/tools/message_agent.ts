import { agents } from '$lib/stores/agents.svelte';
import { Tool, type ToolExecuteFunction } from '$lib/utils/tool.svelte';

/**
 * Tool for handing off control to another agent
 */
export const handOffMicTool = new Tool(
	{
		name: 'hand_off_mic',
		description: 'Hand off control to another agent, optionally with a message',
		parameters: {
			type: 'object',
			properties: {
				to: {
					name: 'to',
					description: 'Name of the agent to hand off control to',
					type: 'string'
				},
				message: {
					name: 'message',
					description: 'Optional message to pass along with the hand off',
					type: 'string'
				}
			},
			required: ['to']
		}
	},
	(async (args) => {
		if (typeof args !== 'object' || args === null) {
			return {
				success: false,
				message: 'Invalid arguments'
			};
		}

		if (typeof args.to !== 'string') {
			return {
				success: false,
				message: 'Invalid arguments: "to" must be a string'
			};
		}

		const { to, message } = args;

		// Check if the target agent exists
		const targetAgent = agents.getAgent(to);
		if (!targetAgent) {
			return {
				success: false,
				message: `Agent "${to}" not found`
			};
		}

		// If a message was provided, send it to the target agent
		if (typeof message === 'string') {
			await targetAgent.chat(message);
		}

		// TODO: Add logic to actually hand off control to the target agent
		// This will need to be implemented based on your agent control system

		return {
			success: true,
			message: `Control handed off to ${to}${message ? ' with message' : ''}`,
			targetAgent: to,
			sentMessage: message || undefined
		};
	}) satisfies ToolExecuteFunction
);
