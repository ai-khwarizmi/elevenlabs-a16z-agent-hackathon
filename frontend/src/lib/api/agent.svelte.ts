import type {
	ChatCompletionMessageParam,
	ChatCompletionTool
} from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { createOpenAI } from './ai/openai.svelte';
import { getStoredKeys } from '$lib/storage/keys';
import { uid } from 'uid';

/**
 * Interface for OpenAI-compatible function parameters
 */
interface ToolParameter {
	name: string;
	description: string;
	type: string;
	required?: boolean;
	enum?: string[];
}

/**
 * Interface for OpenAI-compatible function definition
 */
interface ToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: string;
		properties: Record<string, ToolParameter>;
		required?: string[];
	};
}

/**
 * Type for tool execution arguments
 */
type ToolArgs = Record<string, string | number | boolean | object>;

/**
 * Type for tool execution result
 */
type ToolResult = string | number | boolean | object | null;

/**
 * Type for tool execution function
 */
export type ToolExecuteFunction = (args: ToolArgs) => Promise<ToolResult>;

/**
 * Global state for all agents - using Svelte's $state for reactivity
 */
export const agents = $state<Agent[]>([]);

/**
 * Functions to manage the global agents state
 */
export const agentManager = {
	/**
	 * Add a new agent to the global state
	 */
	addAgent(agent: Agent): void {
		agents.push(agent);
	},

	/**
	 * Remove an agent from the global state by name
	 */
	removeAgent(name: string): void {
		const index = agents.findIndex((a) => a.getName() === name);
		if (index !== -1) {
			agents.splice(index, 1);
		}
	},

	/**
	 * Get an agent by name
	 */
	getAgent(name: string): Agent | undefined {
		return agents.find((a) => a.getName() === name);
	},

	/**
	 * Get all agents
	 */
	getAllAgents(): Agent[] {
		return [...agents];
	},

	/**
	 * Clear all agents
	 */
	clearAgents(): void {
		agents.length = 0;
	}
};

/**
 * Class representing a tool that can be used by an agent
 */
export class Tool {
	private definition: ToolDefinition;
	private executeFunction: ToolExecuteFunction;

	constructor(definition: ToolDefinition, executeFunction: ToolExecuteFunction) {
		this.definition = definition;
		this.executeFunction = executeFunction;
	}

	/**
	 * Get the OpenAI-compatible function definition
	 */
	getDefinition(): ChatCompletionTool {
		return {
			type: 'function',
			function: {
				name: this.definition.name,
				description: this.definition.description,
				parameters: this.definition.parameters
			}
		};
	}

	/**
	 * Execute the tool with the given arguments
	 */
	async execute(args: ToolArgs): Promise<ToolResult> {
		return await this.executeFunction(args);
	}
}

/**
 * Class representing an AI agent with a name, personality, and set of tools
 */
export class Agent {
	readonly id: string;
	private name: string;
	private personality: string;
	private tools: Tool[];
	private isActive: boolean;
	private messageLog: ChatCompletionMessageParam[];

	private openai: OpenAI;

	constructor(name: string, personality: string, tools: Tool[], options?: { id?: string }) {
		this.id = options?.id ?? uid();
		this.name = name;
		this.personality = personality;
		this.tools = tools;
		this.isActive = false;
		this.messageLog = [
			{
				role: 'system',
				content: personality
			}
		];

		// Init openai
		const { openaiKey } = getStoredKeys();
		this.openai = createOpenAI(openaiKey);
	}

	/**
	 * Get the agent's name
	 */
	getName(): string {
		return this.name;
	}

	/**
	 * Get the agent's personality description
	 */
	getPersonality(): string {
		return this.personality;
	}

	/**
	 * Get all tools available to the agent
	 */
	getTools(): Tool[] {
		return this.tools;
	}

	/**
	 * Get OpenAI-compatible function definitions for all tools
	 */
	getToolDefinitions(): ChatCompletionTool[] {
		return this.tools.map((tool) => tool.getDefinition());
	}

	/**
	 * Get the message log
	 */
	getMessageLog(): ChatCompletionMessageParam[] {
		return this.messageLog;
	}

	/**
	 * Check if the agent is currently active
	 */
	isAgentActive(): boolean {
		return this.isActive;
	}

	/**
	 * Set the agent's active state
	 */
	setActive(active: boolean): void {
		this.isActive = active;
	}

	/**
	 * Execute a tool by name with the given arguments
	 */
	private async executeTool(toolName: string, args: ToolArgs): Promise<ToolResult> {
		const tool = this.tools.find((t) => t.getDefinition().function.name === toolName);
		if (!tool) {
			throw new Error(`Tool "${toolName}" not found`);
		}
		return await tool.execute(args);
	}

	/**
	 * Send a message to the agent and get its response
	 * This function handles the entire conversation flow including tool execution
	 */
	async chat(userMessage: string): Promise<string> {
		// Add user message to log
		this.messageLog = [
			...this.messageLog,
			{
				role: 'user',
				content: userMessage
			}
		];

		while (true) {
			// Get AI response
			const completion = await this.openai.chat.completions.create({
				model: 'gpt-4',
				messages: this.messageLog,
				tools: this.getToolDefinitions(),
				tool_choice: 'auto'
			});

			const response = completion.choices[0].message;

			// Add AI response to log
			this.messageLog = [...this.messageLog, response];

			// If there's a function call, execute it
			if (response.tool_calls) {
				await Promise.all(
					response.tool_calls.map(async (toolCall) => {
						const result = await this.executeTool(
							toolCall.function.name,
							JSON.parse(toolCall.function.arguments)
						);

						// Add tool result to message log
						this.messageLog = [
							...this.messageLog,
							{
								role: 'tool',
								tool_call_id: toolCall.id,
								content: JSON.stringify(result)
							}
						];
					})
				);

				// Continue the loop to get AI's response to the tool results
				continue;
			}

			// If no function call, return the AI's response
			return response.content || '';
		}
	}
}
