import { Agent, Tool } from '$lib/api/agent.svelte';
import { agentManager } from '$lib/stores/agents.svelte';

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
	async (args) => {
		const { name, personality } = args as { name: string; personality: string };

		// Create a new agent with the same tools as the helper
		const newAgent = new Agent(
			name,
			personality,
			[] // New agents start with no tools
		);

		// Add the agent to the global state
		agentManager.addAgent(newAgent);

		return {
			success: true,
			message: `Created new agent: ${name}`,
			agentName: name
		};
	}
);
