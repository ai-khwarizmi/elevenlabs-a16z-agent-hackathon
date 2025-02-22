import { Agent } from '$lib/utils/agent.svelte';
import type { Tool } from '$lib/utils/tool.svelte';
import { agents } from '$lib/stores/agents.svelte';
import { inviteTool } from '../tools/invite_agent';
import { todoListTool } from '../tools/todolist';
import { messageTool } from '../tools/message_agent';
import { registerTool } from '$lib/utils/tool-registry.svelte';

// Register all base tools
registerTool(inviteTool);
registerTool(todoListTool);
registerTool(messageTool);

export const agentBaseTools: Tool[] = [inviteTool, todoListTool, messageTool];

/**
 * Create the helper agent
 */
export function createHelperAgent(): Agent {
	const personality = `I am a helpful AI assistant that can help coordinate and manage other AI agents. 
I can understand user requests and invite specialized agents when needed.
I aim to be friendly, clear, and efficient in my communication.
When inviting new agents, I carefully consider what expertise is needed and create agents with well-defined roles.
I maintain a todo list to keep track of tasks and prioritize them appropriately.`;

	const helperAgent = new Agent('Helper', personality, agentBaseTools);

	// Add to global agent state
	agents.addAgent(helperAgent);

	return helperAgent;
}
