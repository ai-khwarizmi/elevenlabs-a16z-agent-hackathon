import { Tool, type ToolExecuteFunction } from '$lib/utils/tool.svelte';

/**
 * Tool for handing off control to the next agent
 */
export const handOffMicTool = new Tool(
	{
		name: 'hand_off_mic',
		description: 'Hand off control to the next agent, optionally with a message',
		parameters: {
			type: 'object',
			properties: {
				message: {
					name: 'message',
					description: 'Optional message to pass along with the hand off',
					type: 'string'
				}
			},
			required: []
		}
	},
	(async (args, agent) => {
		if (args !== null && typeof args === 'object') {
			const message = typeof args.message === 'string' ? args.message : undefined;

			// Make the current agent idle
			agent.makeIdle();

			// If a message was provided, it will be treated as a chat/voice message
			// The message will be handled by the system when control is handed off

			return {
				success: true,
				message: message ? 'Handing off control with message' : 'Handing off control',
				sentMessage: message
			};
		}

		return {
			success: false,
			message: 'Invalid arguments'
		};
	}) satisfies ToolExecuteFunction
);
