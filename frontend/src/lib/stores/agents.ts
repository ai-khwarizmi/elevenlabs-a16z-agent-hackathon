import { writable } from 'svelte/store';
import type { Agent } from '$lib/api/agent.svelte';

export const agents = writable<Agent[]>([]);

export const agentManager = {
	/**
	 * Add a new agent to the global state
	 */
	addAgent(agent: Agent): void {
		agents.update((currentAgents) => [...currentAgents, agent]);
	},

	/**
	 * Remove an agent from the global state by name
	 */
	removeAgent(name: string): void {
		agents.update((currentAgents) => currentAgents.filter((a) => a.getName() !== name));
	},

	/**
	 * Get an agent by name
	 */
	getAgent(name: string): Promise<Agent | undefined> {
		return new Promise((resolve) => {
			agents.subscribe((currentAgents) => {
				resolve(currentAgents.find((a) => a.getName() === name));
			})();
		});
	},

	/**
	 * Get all agents
	 */
	getAllAgents(): Promise<Agent[]> {
		return new Promise((resolve) => {
			agents.subscribe((currentAgents) => {
				resolve([...currentAgents]);
			})();
		});
	},

	/**
	 * Clear all agents
	 */
	clearAgents(): void {
		agents.set([]);
	}
};
