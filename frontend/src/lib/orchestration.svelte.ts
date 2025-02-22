import { agents } from '../lib/stores/agents.svelte';
import type { Agent } from '../lib/utils/agent.svelte';

async function mainLoop() {
	while (true) {
		// Get all agents from the store
		const agentList: Agent[] = agents.list;

		// Check if all agents are idle
		const allIdle = agentList.every((agent: Agent) => agent.getState() === 'IDLE');

		if (allIdle && agentList.length > 0) {
			console.log('All agents are currently idle');
		}

		// Wait a bit before next check to avoid tight loop
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

let mainLoopStarted = false;

export function startMainLoop() {
	if (!mainLoopStarted) {
		mainLoopStarted = true;
		mainLoop();
	}
}
