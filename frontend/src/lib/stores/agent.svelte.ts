import type { Agent } from '$lib/utils/agent';

/**
 * Global state for all agents - using Svelte's $state for reactivity
 */
let agentList = $state<Agent[]>([]);

export const agents = {
	get list() {
		return agentList;
	},
	set list(value: Agent[]) {
		agentList = value;
	},
	addAgent(agent: Agent): void {
		agentList.push(agent);
	},
	removeAgent(name: string): void {
		const index = agentList.findIndex((a) => a.getName() === name);
		if (index !== -1) {
			agentList.splice(index, 1);
		}
	},
	getAgent(name: string): Agent | undefined {
		return agentList.find((a) => a.getName() === name);
	},
	getAgentById(id: string): Agent | undefined {
		return agentList.find((a) => a.id === id);
	},
	clearAgents(): void {
		agentList.length = 0;
	}
};
