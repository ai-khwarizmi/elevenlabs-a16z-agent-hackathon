import type {
	ChatCompletionMessageParam,
	ChatCompletionTool
} from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { createOpenAI } from '../api/ai/openai.svelte';
import { getStoredKeys } from '$lib/storage/keys';
import { fal } from '@fal-ai/client';
import { uid } from 'uid';
import { storeProfilePicture, getProfilePicture } from '$lib/storage/indexeddb';
import type { Tool, ToolArgs, ToolResult } from './tool';

// Interface for a todo item
interface TodoItem {
	id: string;
	title: string;
	description: string;
	priority: 'high' | 'medium' | 'low';
	status: 'pending' | 'in_progress' | 'completed';
	requestedBy?: string;
	createdAt: Date;
	completedAt?: Date;
}

/**
 * Class representing an AI agent with a name, personality, and set of tools
 */
export class Agent {
	readonly id: string;
	private name: string;
	private personality: string;
	private tools: Tool[];
	private isActive = $state(false);
	private messageLog: ChatCompletionMessageParam[];
	private profilePicture = $state<string | null>(null);

	private openai: OpenAI;
	private todos: TodoItem[] = [];

	constructor(name: string, personality: string, tools: Tool[], options?: { id?: string }) {
		this.id = options?.id ?? uid();
		this.name = name;
		this.personality = personality;
		this.tools = tools;
		this.messageLog = [
			{
				role: 'system',
				content: personality
			}
		];

		// Init openai
		const { openaiKey } = getStoredKeys();
		this.openai = createOpenAI(openaiKey);

		// Initialize profile picture
		this.initProfilePicture();
	}

	/**
	 * Get the prompt used to generate the agent's profile picture
	 */
	getProfilePrompt(): string {
		return `South Park style character portrait of: ${this.personality}. Simple flat colors, thick black outlines, oval-shaped head, small body, simple geometric shapes, paper cutout aesthetic. Close-up portrait with solid color background.`;
	}

	private async initProfilePicture(): Promise<void> {
		try {
			const prompt = this.getProfilePrompt();

			// First try to get from IndexedDB
			const storedUrl = await getProfilePicture(prompt);
			if (storedUrl) {
				this.profilePicture = storedUrl;
				return;
			}

			// If not found, generate new image
			const { falKey } = getStoredKeys();
			fal.config({
				credentials: falKey
			});

			// Call the FLUX.1 model to generate the image
			const result = await fal.subscribe('fal-ai/flux/schnell', {
				input: {
					prompt,
					image_size: 'square',
					num_inference_steps: 4,
					num_images: 1,
					enable_safety_checker: true
				}
			});

			// Store the image in IndexedDB and get local URL
			if (result.data.images && result.data.images.length > 0) {
				const remoteUrl = result.data.images[0].url;
				const localUrl = await storeProfilePicture(prompt, remoteUrl);
				this.profilePicture = localUrl;
			}
		} catch (error) {
			console.error('Failed to generate/store profile picture:', error);
			this.profilePicture = '';
		}
	}

	/**
	 * Get the agent's profile picture URL
	 */
	getProfilePicture(): string | null {
		return this.profilePicture;
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

	/**
	 * Get all todos for this agent
	 */
	getTodos(): TodoItem[] {
		return this.todos;
	}

	/**
	 * Add a new todo
	 */
	addTodo(todo: Omit<TodoItem, 'id' | 'createdAt' | 'status'>): TodoItem {
		const newTodo: TodoItem = {
			...todo,
			id: uid(),
			status: 'pending',
			createdAt: new Date()
		};
		this.todos.push(newTodo);
		return newTodo;
	}

	/**
	 * Complete a todo
	 */
	completeTodo(todoId: string): TodoItem | null {
		const todo = this.todos.find((t) => t.id === todoId);
		if (todo) {
			todo.status = 'completed';
			todo.completedAt = new Date();
			return todo;
		}
		return null;
	}

	/**
	 * Update todo priority
	 */
	updateTodoPriority(todoId: string, priority: TodoItem['priority']): TodoItem | null {
		const todo = this.todos.find((t) => t.id === todoId);
		if (todo) {
			todo.priority = priority;
			return todo;
		}
		return null;
	}
}
