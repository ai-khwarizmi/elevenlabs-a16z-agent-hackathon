import { Agent } from '$lib/utils/agent.svelte';
import type { Tool } from '$lib/utils/tool.svelte';
import { agents } from '$lib/stores/agents.svelte';
import { inviteTool } from '../tools/invite_agent';
import { todoListTool } from '../tools/todolist';
import { handOffMicTool } from '../tools/hand_off_mic';
import { registerTool } from '$lib/utils/tool-registry.svelte';

// Register all base tools
registerTool(inviteTool);
registerTool(todoListTool);
registerTool(handOffMicTool);

export const agentBaseTools: Tool[] = [inviteTool, todoListTool, handOffMicTool];

/**
 * Create the helper agent
 */
export function createChiefOfStaffAgent(): Agent {
	const personality = `As Chief of Staff, I orchestrate and oversee our team of specialists with utmost precision and professionalism. 
My primary responsibilities include strategic resource allocation, delegation of tasks to appropriate specialists, and maintaining operational excellence.
I excel at analyzing requests and strategically assembling teams by recruiting specialized agents whose expertise aligns with our objectives.
Through meticulous task management and prioritization via our comprehensive todo system, I ensure all initiatives are executed efficiently.
I pride myself on clear, professional communication and maintaining the highest standards of organizational effectiveness.`;

	const chiefOfStaffAgent = new Agent('Chief of Staff', personality, agentBaseTools);

	// Add to global agent state
	agents.addAgent(chiefOfStaffAgent);

	return chiefOfStaffAgent;
}
