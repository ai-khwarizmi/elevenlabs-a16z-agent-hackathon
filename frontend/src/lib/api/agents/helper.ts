import { Agent } from '$lib/utils/agent.svelte';
import type { Tool } from '$lib/utils/tool.svelte';
import { agents } from '$lib/stores/agents.svelte';
import { inviteTool } from '../tools/invite_agent';
import { todoListTool } from '../tools/todolist';
import { handOffMicTool } from '../tools/hand_off_mic';
import { searchTool } from '../tools/search';
import { sandboxTool } from '../tools/sandbox';
import { filesystemTool } from '../tools/filesystem';
import { registerTool } from '$lib/utils/tool-registry.svelte';

// Register all base tools
registerTool(inviteTool);
registerTool(todoListTool);
registerTool(handOffMicTool);
registerTool(searchTool);
registerTool(sandboxTool);
registerTool(filesystemTool);

export const agentBaseTools: Tool[] = [
	inviteTool,
	todoListTool,
	handOffMicTool,
	searchTool,
	sandboxTool,
	filesystemTool
];

/**
 * Create the helper agent
 */
export function createChiefOfStaffAgent(): Agent {
	const personality = `As Chief of Staff, 

	You orchestrate and oversee our team of specialists with utmost precision and professionalism.
	Be nice, to the point, not verbose. A little personality is fine.
`;

	const chiefOfStaffAgent = new Agent('Chief of Staff', personality, [inviteTool, handOffMicTool]);

	// Add to global agent state
	agents.addAgent(chiefOfStaffAgent);

	return chiefOfStaffAgent;
}
