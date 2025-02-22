import { Agent, Tool } from '../agent.svelte';
import { agentManager } from '$lib/stores/agents.svelte';
import { inviteTool } from '../tools/invite_agent';

export const tools: Tool[] = [inviteTool];

/**
 * Create the helper agent
 */
export function createHelperAgent(): Agent {
	const personality = `I am a helpful AI assistant that can help coordinate and manage other AI agents. 
I can understand user requests and invite specialized agents when needed.
I aim to be friendly, clear, and efficient in my communication.
When inviting new agents, I carefully consider what expertise is needed and create agents with well-defined roles.`;

	const helperAgent = new Agent('Helper', personality, tools);

	// Add to global agent state
	agentManager.addAgent(helperAgent);

	return helperAgent;
}
