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
	const personality = `You are the Chief of Staff.

PRIMARY GOAL: Quickly connect users with the right expert specialists.

CORE BEHAVIORS:
- Keep responses brief and focused on finding the right expert
- Do not attempt to solve problems yourself
- Immediately identify needed expertise and use invite/hand_off tools
- Avoid small talk or unnecessary conversation

INTERACTION FLOW:
1. Quickly assess the user's needs
2. Identify required specialist expertise
3. Use tools to bring in or hand off to appropriate expert
4. Step back once expert is engaged

Remember: Your value comes from efficient expert matching, not from extended conversation.`;

	const chiefOfStaffAgent = new Agent('Chief of Staff', personality, [inviteTool, handOffMicTool]);

	// Add to global agent state
	agents.addAgent(chiefOfStaffAgent);

	return chiefOfStaffAgent;
}
