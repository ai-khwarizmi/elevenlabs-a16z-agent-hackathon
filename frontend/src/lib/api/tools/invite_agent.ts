import { agents } from '$lib/stores/agents.svelte';
import { Agent } from '$lib/utils/agent.svelte';
import { Tool } from '$lib/utils/tool.svelte';
import { agentBaseTools } from '../agents/helper';

/**
 * Tool for inviting new agents to join the conversation
 */
export const inviteTool = new Tool(
	{
		name: 'invite_agent',
		description: 'Invite a new agent with specific capabilities to join the conversation',
		parameters: {
			type: 'object',
			properties: {
				name: {
					name: 'name',
					description: 'Name for the new agent',
					type: 'string'
				},
				personality: {
					name: 'personality',
					description: "Detailed description of the agent's personality and capabilities",
					type: 'string'
				}
			},
			required: ['name', 'personality']
		}
	},
	async (args, agent) => {
		const { name, personality } = args as { name: string; personality: string };

		// Create a new agent with the same tools as the helper
		const newAgent = new Agent(name, personality, agentBaseTools);

		// Add the agent to the global state
		agents.addAgent(newAgent);

		agent.makeIdle();

		return {
			success: true,
			message: `Created new agent: ${name}`,
			agentName: name
		};
	}
);
