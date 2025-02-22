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
import type { Tool, ToolArgs, ToolResult } from './tool.svelte';
import { createVoice } from '../api/ai/elevenlabs.svelte';
import { storeVoiceId, getVoiceId } from '../storage/voice';
import { getTool } from './tool-registry.svelte';

// Interface for a todo item
interface Todo {
	id: string;
	title: string;
	description: string;
	priority: 'high' | 'medium' | 'low';
	status: 'pending' | 'in_progress' | 'completed';
	requestedBy?: string;
	createdAt: Date;
	completedAt?: Date;
}

interface SerializedAgent {
	id: string;
	name: string;
	personality: string;
	toolIds: string[];
	isActive: boolean;
	messageLog: ChatCompletionMessageParam[];
	profilePicture: string | null;
	todos: Todo[];
	elevenLabsVoiceId: string | null;
}

/**
 * Class representing an AI agent with a name, personality, and set of tools
 */
export class Agent {
	readonly id: string;
	private name: string;
	private personality: string;
	private toolIds: string[];
	private isActive = $state(false);
	private messageLog = $state<ChatCompletionMessageParam[]>([]);
	private profilePicture = $state<string | null>(null);
	private todos = $state<Todo[]>([]);
	private elevenLabsVoiceId = $state<string | null>(null);

	private openai: OpenAI | null = null;

	constructor(name: string, personality: string, tools: Tool[], options?: { id?: string }) {
		this.id = options?.id ?? uid();
		this.name = name;
		this.personality = personality;
		this.toolIds = tools.map((tool) => tool.getId());
		this.messageLog = [
			{
				role: 'system',
				content: personality
			}
		];

		// Initialize profile picture and voice
		this.initProfilePicture();
		this.initVoice();
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
		return this.toolIds.map((id) => {
			const tool = getTool(id);
			if (!tool) {
				throw new Error(`Tool with ID "${id}" not found`);
			}
			return tool;
		});
	}

	/**
	 * Get OpenAI-compatible function definitions for all tools
	 */
	getToolDefinitions(): ChatCompletionTool[] {
		return this.getTools().map((tool) => tool.getDefinition());
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
		const tool = this.getTools().find((t) => t.getDefinition().function.name === toolName);
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
			const completion = await this.getOpenAI().chat.completions.create({
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
	 * Get the agent's todos
	 */
	getTodos(): Todo[] {
		return this.todos;
	}

	/**
	 * Add a todo to the agent's todos
	 */
	addTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'status'>): void {
		this.todos = [
			...this.todos,
			{
				...todo,
				id: uid(),
				createdAt: new Date(),
				status: 'pending'
			}
		];
	}

	/**
	 * Complete a todo
	 */
	completeTodo(todoId: string): Todo | null {
		const index = this.todos.findIndex((t) => t.id === todoId);
		if (index !== -1) {
			const todo = this.todos[index];
			this.todos.splice(index, 1);
			return todo;
		}
		return null;
	}

	/**
	 * Update a todo
	 */
	updateTodo(todo: Todo): void {
		this.todos = this.todos.map((t) => (t.id === todo.id ? todo : t));
	}

	/**
	 * Get the voice description used to generate the agent's voice
	 */
	getVoiceDescription(): string {
		return `${this.name} with the following personality: ${this.personality}`;
	}

	private async initVoice(): Promise<void> {
		console.log('Initializing voice');
		try {
			console.log('Getting voice description');
			const description = this.getVoiceDescription();

			// First try to get from IndexedDB
			console.log('Getting voice ID from IndexedDB');
			const storedVoiceId = await getVoiceId(description);
			if (storedVoiceId) {
				this.elevenLabsVoiceId = storedVoiceId;
				console.log('Voice ID found in IndexedDB: ', storedVoiceId);
				return;
			}

			// If not found, generate new voice
			const { elevenLabsKey } = getStoredKeys();
			if (!elevenLabsKey) {
				console.log('No ElevenLabs API key found');
				return;
			}

			const voiceId = await createVoice(description, elevenLabsKey);
			await storeVoiceId(description, voiceId);
			this.elevenLabsVoiceId = voiceId;
		} catch (error) {
			console.error('Failed to generate/store voice:', error);
			this.elevenLabsVoiceId = null;
		}
	}

	/**
	 * Get the agent's voice ID
	 */
	getVoiceId(): string | null {
		return this.elevenLabsVoiceId;
	}

	/**
	 * Get the OpenAI client, creating it if necessary
	 */
	private getOpenAI(): OpenAI {
		if (!this.openai) {
			const { openaiKey } = getStoredKeys();
			this.openai = createOpenAI(openaiKey);
		}
		return this.openai;
	}

	/**
	 * Convert the agent to a JSON-serializable object
	 */
	toJSON(): SerializedAgent {
		return {
			id: this.id,
			name: this.name,
			personality: this.personality,
			toolIds: this.toolIds,
			isActive: this.isActive,
			messageLog: this.messageLog,
			profilePicture: this.profilePicture,
			todos: this.todos,
			elevenLabsVoiceId: this.elevenLabsVoiceId
		};
	}

	/**
	 * Create an agent from a serialized object
	 */
	static fromJSON(json: SerializedAgent): Agent {
		try {
			const agent = new Agent(json.name, json.personality, [], { id: json.id });
			agent.toolIds = json.toolIds;
			agent.isActive = json.isActive;
			agent.messageLog = json.messageLog;
			agent.profilePicture = json.profilePicture;
			agent.todos = json.todos;
			agent.elevenLabsVoiceId = json.elevenLabsVoiceId;

			const requiredNonNullFields = [
				'id',
				'name',
				'personality',
				'toolIds',
				'isActive',
				'messageLog',
				'todos'
			];
			for (const key of requiredNonNullFields) {
				if (json[key as keyof SerializedAgent] === null) {
					throw new Error(`Required property "${key}" cannot be null`);
				}
			}

			return agent;
		} catch (error) {
			console.warn('Failed to create agent from JSON:', error);
			throw error;
		}
	}
}
