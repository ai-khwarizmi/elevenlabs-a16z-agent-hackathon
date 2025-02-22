import { type Agent } from '$lib/api/agent.svelte';

let agentList = $state<Agent[]>([]);

export const agents = {
	get list() {
		return agentList;
	},
	set list(value: Agent[]) {
		agentList = value;
	}
};

export const agentManager = {
	/**
	 * Add a new agent to the global state
	 */
	addAgent(agent: Agent): void {
		agentList = [...agentList, agent];
	},

	/**
	 * Remove an agent from the global state by name
	 */
	removeAgent(name: string): void {
		agentList = agentList.filter((a) => a.getName() !== name);
	},

	/**
	 * Get an agent by name
	 */
	getAgent(name: string): Agent | undefined {
		return agentList.find((a) => a.getName() === name);
	},

	/**
	 * Get all agents
	 */
	getAllAgents(): Agent[] {
		return [...agentList];
	},

	/**
	 * Clear all agents
	 */
	clearAgents(): void {
		agentList = [];
	}
};
