import { Tool, type ToolExecuteFunction } from '$lib/utils/tool.svelte';
import { agents } from '$lib/stores/agents.svelte';

/**
 * Tool for handing off control to the next agent or a specific agent by ID
 */
export const handOffMicTool = new Tool(
	{
		name: 'hand_off_mic',
		description:
			'Hand off control to the next agent or a specific agent by ID, optionally with a message',
		parameters: {
			type: 'object',
			properties: {
				message: {
					name: 'message',
					description: 'Optional message to pass along with the hand off',
					type: 'string'
				},
				agentId: {
					name: 'agentId',
					description:
						'Optional ID of the specific agent to hand off to. If not provided, hands off to the next agent.',
					type: 'string'
				}
			},
			required: []
		}
	},
	(async (args, currentAgent) => {
		if (args !== null && typeof args === 'object') {
			const message = typeof args.message === 'string' ? args.message : undefined;
			const targetAgentId = typeof args.agentId === 'string' ? args.agentId : undefined;

			// Make the current agent idle
			currentAgent.makeIdle();

			// If a specific agent was requested, activate them
			if (targetAgentId) {
				const targetAgent = agents.getAgentById(targetAgentId);
				if (targetAgent) {
					targetAgent.makeActive();
				} else {
					return {
						success: false,
						message: `Target agent with ID ${targetAgentId} not found`
					};
				}
			}

			return {
				success: true,
				message: `Handing off control${targetAgentId ? ` to agent ${targetAgentId}` : ''}${message ? ' with message' : ''}`,
				sentMessage: message,
				targetAgentId
			};
		}

		return {
			success: false,
			message: 'Invalid arguments'
		};
	}) satisfies ToolExecuteFunction
);
