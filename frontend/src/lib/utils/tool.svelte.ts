import type { ChatCompletionTool } from 'openai/resources/index.mjs';

/**
 * Interface for OpenAI-compatible function parameters
 */
export interface ToolParameter {
	name: string;
	description: string;
	type: string;
	required?: boolean;
	enum?: string[];
}

/**
 * Interface for OpenAI-compatible function definition
 */
export interface ToolDefinition {
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
export type ToolArgs = Record<string, string | number | boolean | object>;

/**
 * Type for tool execution result
 */
export type ToolResult = string | number | boolean | object | null;

/**
 * Type for tool execution function
 */
export type ToolExecuteFunction = (args: ToolArgs) => Promise<ToolResult>;

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
