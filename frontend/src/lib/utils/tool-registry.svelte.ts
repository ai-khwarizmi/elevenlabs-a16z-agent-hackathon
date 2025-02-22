import type { Tool } from './tool.svelte';

const toolRegistry = new Map<string, Tool>();

export function registerTool(tool: Tool): void {
	toolRegistry.set(tool.getId(), tool);
}

export function getTool(id: string): Tool | undefined {
	return toolRegistry.get(id);
}

export function getToolByName(name: string): Tool | undefined {
	return Array.from(toolRegistry.values()).find(
		(tool) => tool.getDefinition().function.name === name
	);
}

export function getAllTools(): Tool[] {
	return Array.from(toolRegistry.values());
}
