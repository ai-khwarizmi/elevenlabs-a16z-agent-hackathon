import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { createOpenAI } from '../api/ai/openai.svelte';
import { getStoredKeys } from '$lib/storage/keys';
import { fal } from '@fal-ai/client';
import { uid } from 'uid';
import { storeProfilePicture, getProfilePicture } from '$lib/storage/indexeddb';
import type { Tool, ToolArgs, ToolResult } from './tool.svelte';
import { createAgent, createVoice } from '../api/ai/elevenlabs.svelte';
import { storeVoiceId, getVoiceId } from '../storage/voice';
import { getTool } from './tool-registry.svelte';
import { createMachine, interpret } from 'xstate';
import type { TimestampedMessage } from '$lib/types/messages';
import { agents } from '$lib/stores/agents.svelte';
import {
	getGlobalChatlog,
	mergeMessages,
	normalizeAgentName,
	addAiJoinEvent,
	addAiLeaveEvent
} from '$lib/stores/chatlog.svelte';
import { Conversation } from '@11labs/client';
import { getAgentId, storeAgentId } from '$lib/storage/agent.storage';

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

type AgentState = 'IDLE' | 'VOICE_ACTIVE' | 'TEXT_ACTIVE' | 'LEFT_CALL' | 'WORKING' | 'RAISED_HAND';

interface SerializedAgent {
	id: string;
	name: string;
	personality: string;
	toolIds: string[];
	messageLog: TimestampedMessage[];
	profilePicture: string | null;
	todos: Todo[];
	elevenLabsVoiceId: string | null;
	state: AgentState;
}

type AgentContext = {
	agent: Agent;
};

type AgentEvent = {
	type: string;
};

// Create the state machine
const createAgentMachine = (agent: Agent) =>
	createMachine(
		{
			id: 'agent',
			initial: agent.getState() || 'IDLE',
			context: { agent } as AgentContext,
			schemas: {
				context: {} as AgentContext,
				events: {} as AgentEvent
			},
			states: {
				IDLE: {
					entry: ['onEnterIdle'],
					exit: ['onExitIdle'],
					on: {
						ACTIVATE_VOICE: {
							target: 'VOICE_ACTIVE',
							actions: ['onActivateVoice']
						},
						ACTIVATE_TEXT: {
							target: 'TEXT_ACTIVE',
							actions: ['onActivateText']
						},
						LEAVE: {
							target: 'LEFT_CALL',
							actions: ['onLeave']
						},
						GO_IDLE: {
							target: 'IDLE',
							actions: ['onGoIdle']
						}
					}
				},
				VOICE_ACTIVE: {
					entry: ['onEnterVoiceActive'],
					exit: ['onExitVoiceActive'],
					on: {
						GO_IDLE: {
							target: 'IDLE',
							actions: ['onGoIdle']
						},
						START_WORK: {
							target: 'WORKING',
							actions: ['onStartWork']
						},
						SWITCH_TO_TEXT: {
							target: 'TEXT_ACTIVE',
							actions: ['onSwitchToText']
						}
					}
				},
				TEXT_ACTIVE: {
					entry: ['onEnterTextActive'],
					exit: ['onExitTextActive'],
					on: {
						GO_IDLE: {
							target: 'IDLE',
							actions: ['onGoIdle']
						},
						START_WORK: {
							target: 'WORKING',
							actions: ['onStartWork']
						},
						SWITCH_TO_VOICE: {
							target: 'VOICE_ACTIVE',
							actions: ['onSwitchToVoice']
						}
					}
				},
				LEFT_CALL: {
					entry: ['onEnterLeftCall'],
					on: {
						GO_IDLE: {
							target: 'IDLE',
							actions: ['onGoIdle']
						}
					}
				},
				WORKING: {
					entry: ['onEnterWorking'],
					exit: ['onExitWorking'],
					on: {
						RETURN_TO_VOICE: {
							target: 'VOICE_ACTIVE',
							actions: ['onReturnToVoice']
						},
						RETURN_TO_TEXT: {
							target: 'TEXT_ACTIVE',
							actions: ['onReturnToText']
						},
						RAISE_HAND: {
							target: 'RAISED_HAND',
							actions: ['onRaiseHand']
						}
					}
				},
				RAISED_HAND: {
					entry: ['onEnterRaisedHand'],
					on: {
						RETURN_TO_WORK: {
							target: 'WORKING',
							actions: ['onReturnToWork']
						}
					}
				}
			}
		},
		{
			actions: {
				onEnterIdle: ({ context }) => {
					console.log(`${context.agent.getName()} entered IDLE state`);
				},
				onExitIdle: ({ context }) => {
					console.log(`${context.agent.getName()} exiting IDLE state`);
				},
				onActivateVoice: ({ context }) => {
					console.log(`${context.agent.getName()} activating voice mode`);
				},
				onActivateText: ({ context }) => {
					console.log(`${context.agent.getName()} activating text mode`);
				},
				onEnterVoiceActive: ({ context }) => {
					console.log(`${context.agent.getName()} entered VOICE_ACTIVE state`);
				},
				onEnterTextActive: ({ context }) => {
					console.log(`${context.agent.getName()} entered TEXT_ACTIVE state`);
				},
				onEnterWorking: ({ context }) => {
					console.log(`${context.agent.getName()} entered WORKING state`);
				},
				onEnterLeftCall: ({ context }) => {
					console.log(`${context.agent.getName()} entered LEFT_CALL state`);
				},
				onEnterRaisedHand: ({ context }) => {
					console.log(`${context.agent.getName()} entered RAISED_HAND state`);
				}
			}
		}
	);

/**
 * Class representing an AI agent with a name, personality, and set of tools
 */
export class Agent {
	readonly id: string;
	private name: string;
	private personality: string;
	private toolIds: string[];
	private messageLog = $state<TimestampedMessage[]>([]);
	private profilePicture = $state<string | null>(null);
	private todos = $state<Todo[]>([]);
	private elevenLabsVoiceId = $state<string | null>(null);
	private elevenLabsAgentId = $state<string | null>(null);
	private state = $state<AgentState>('IDLE');
	private stateMachine: ReturnType<typeof interpret>;
	private openai: OpenAI | null = null;

	private conversation: Conversation | null = null;

	constructor(
		name: string,
		personality: string,
		tools: Tool[],
		options?: { id?: string; initialState?: AgentState }
	) {
		this.id = options?.id ?? uid();
		this.name = name;
		this.personality = personality;
		this.toolIds = tools.map((tool) => tool.getId());
		this.messageLog = [
			{
				role: 'system',
				content: personality,
				timestamp: Date.now(),
				name: 'system'
			}
		];
		this.state = options?.initialState || 'IDLE';

		// Initialize state machine with the correct initial state
		const machine = createAgentMachine(this);
		this.stateMachine = interpret(machine).start();
		this.stateMachine.subscribe((state) => this._onStateChange(state.value as AgentState));

		// Initialize profile picture and voice
		this.initProfilePicture();
		this.initVoice();
		addAiJoinEvent({
			name: this.getName(),
			personality: this.getPersonality()
		});
	}

	private _onStateChange(state: AgentState): void {
		this.state = state;

		if (state === 'VOICE_ACTIVE') {
			this.joinConversation();
		}
		if (state === 'TEXT_ACTIVE') {
			this.leaveConversation();
		}
	}

	private async joinConversation(): Promise<void> {
		if (this.conversation) {
			await this.conversation.endSession().catch((error) => {
				console.error('Error ending conversation: ', error);
			});
		}

		try {
			// request microphone access
			await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (error) {
			console.error('Error requesting microphone access: ', error);
		}

		console.log(`${this.name} joining conversation`);
		this.conversation = await Conversation.startSession({
			agentId: this.id,
			onMessage: (message) => {
				console.log('Message from conversation: ', message);
				this.messageLog = [
					...this.messageLog,
					{
						role: message.source === 'ai' ? 'assistant' : 'user',
						content: message.message,
						timestamp: Date.now(),
						name: message.source === 'ai' ? this.name : 'USER'
					}
				];
			},
			clientTools: {
				get_persona: async () => {
					console.log('Getting persona');
					return this.getPersonality();
				},
				get_chatlog: async () => {
					console.log('Getting chatlog');
					return JSON.stringify(this.getMessageLog());
				}
				// ...this.getToolDefinitions().map((tool) => ({
				// 	[tool.function.name]: async (args: ToolArgs) => {
				// 		console.log('Executing tool: ', tool.function.name);
				// 		const result = await this.executeTool(tool.function.name, args);
				// 		return String(result);
				// 	}
				// }))
			}
		});
	}

	private async leaveConversation(): Promise<void> {
		console.log(`${this.name} leaving conversation`);
		if (this.conversation) {
			await this.conversation.endSession().catch((error) => {
				console.error('Error ending conversation: ', error);
			});
			console.log(`${this.name} conversation ended`);
		} else {
			console.log(`${this.name} no conversation to leave`);
		}
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
	getMessageLog(): TimestampedMessage[] {
		return this.messageLog;
	}

	async initiateTextChat(): Promise<void> {
		console.log('Starting text chat');

		// Get the global transcript
		const globalTranscript = getGlobalChatlog(agents.list);

		// Filter out messages from this agent
		const otherAgentMessages = globalTranscript.filter((msg) => msg.name !== this.getName());

		console.log('adding other agent messages to message log', otherAgentMessages);

		// Get the agent's system message (first message)
		const systemMessage = this.messageLog[0];

		// Merge messages chronologically
		this.messageLog = mergeMessages(systemMessage, this.messageLog.slice(1), otherAgentMessages);
		this.chat(null);
	}

	/**
	 * Execute a tool by name with the given arguments
	 */
	private async executeTool(toolName: string, args: ToolArgs): Promise<ToolResult> {
		const tool = this.getTools().find((t) => t.getDefinition().function.name === toolName);
		if (!tool) {
			throw new Error(`Tool "${toolName}" not found`);
		}
		return await tool.execute(args, this);
	}

	/**
	 * Send a message to the agent and get its response
	 * This function handles the entire conversation flow including tool execution
	 */
	async chat(userMessage: string | null): Promise<string> {
		// Add user message to log if provided
		if (userMessage !== null) {
			this.messageLog = [
				...this.messageLog,
				{
					role: 'user',
					name: 'USER',
					content: userMessage,
					timestamp: Date.now()
				}
			];
		}

		while (true) {
			// Strip timestamp from messages before sending to OpenAI
			const messagesForApi = this.messageLog.map(({ timestamp, ...msg }) => msg);

			// Get AI response
			const completion = await this.getOpenAI().chat.completions.create({
				model: 'gpt-4o',
				messages: messagesForApi,
				tools: this.getToolDefinitions(),
				tool_choice: 'auto'
			});

			const response = completion.choices[0].message;

			// Add AI response to log with timestamp and name
			this.messageLog = [
				...this.messageLog,
				{
					...response,
					timestamp: Date.now(),
					name: normalizeAgentName(this.getName())
				}
			];

			// If there's a function call, execute it and add results before continuing
			if (response.tool_calls && response.tool_calls.length > 0) {
				// Execute all tool calls in parallel and collect their results
				const toolResults = await Promise.all(
					response.tool_calls.map(async (toolCall) => {
						const result = await this.executeTool(
							toolCall.function.name,
							JSON.parse(toolCall.function.arguments)
						);

						// Return both the tool call ID and the result
						return {
							tool_call_id: toolCall.id,
							result
						};
					})
				);

				// Add each tool result to the message log
				for (const { tool_call_id, result } of toolResults) {
					this.messageLog = [
						...this.messageLog,
						{
							role: 'tool',
							name: normalizeAgentName(this.getName()),
							tool_call_id,
							content: JSON.stringify(result),
							timestamp: Date.now()
						}
					];
				}

				// Continue the conversation to get AI's response to the tool results
				continue;
			}

			// If no tool calls, return the response content
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
	 * Update a todo's priority
	 */
	updateTodoPriority(todoId: string, priority: 'high' | 'medium' | 'low'): Todo | null {
		const todo = this.todos.find((t) => t.id === todoId);
		if (todo) {
			const updatedTodo = { ...todo, priority };
			this.updateTodo(updatedTodo);
			return updatedTodo;
		}
		return null;
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

			const voiceId = await createVoice(this.name, description, elevenLabsKey);
			await storeVoiceId(description, voiceId);
			this.elevenLabsVoiceId = voiceId;
		} catch (error) {
			console.error('Failed to generate/store voice:', error);
			this.elevenLabsVoiceId = null;
		} finally {
			await this.initElevenLabsAgent();
		}
	}

	private async initElevenLabsAgent(): Promise<void> {
		const { elevenLabsKey } = getStoredKeys();
		if (!elevenLabsKey) {
			console.log('No ElevenLabs API key found');
			return;
		}

		if (!this.elevenLabsVoiceId) {
			console.log('No ElevenLabs voice ID found');
			return;
		}
		try {
			console.log('Getting agent ID from IndexedDB');
			const storedAgentId = await getAgentId(this.elevenLabsVoiceId);
			if (storedAgentId) {
				this.elevenLabsAgentId = storedAgentId;
				console.log('Agent ID found in IndexedDB: ', storedAgentId);
				return;
			}

			const agentId = await createAgent(this.getVoiceDescription(), this.elevenLabsVoiceId, {
				apiKey: elevenLabsKey
			});
			await storeAgentId(this.elevenLabsVoiceId, agentId);
			this.elevenLabsAgentId = agentId;
		} catch (error) {
			console.error('Failed to create ElevenLabs agent:', error);
			this.elevenLabsAgentId = null;
		}
	}

	/**
	 * Get the agent's voice ID
	 */
	getVoiceId(): string | null {
		return this.elevenLabsVoiceId;
	}

	/**
	 * Get the agent's ElevenLabs agent ID
	 */
	getElevenLabsAgentId(): string | null {
		return this.elevenLabsAgentId;
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
			messageLog: this.messageLog,
			profilePicture: this.profilePicture,
			todos: this.todos,
			elevenLabsVoiceId: this.elevenLabsVoiceId,
			state: this.state
		};
	}

	/**
	 * Create an agent from a serialized object
	 */
	static fromJSON(json: SerializedAgent): Agent {
		try {
			// Filter out any tool IDs that don't exist in the registry
			const validToolIds = json.toolIds.filter((id) => {
				const exists = getTool(id) !== undefined;
				if (!exists) {
					console.warn(`Tool with ID "${id}" not found, removing from agent ${json.name}`);
				}
				return exists;
			});

			const agent = new Agent(json.name, json.personality, [], {
				id: json.id,
				initialState: json.state
			});
			agent.toolIds = validToolIds;
			agent.messageLog = json.messageLog;
			agent.profilePicture = json.profilePicture;
			agent.todos = json.todos;
			agent.elevenLabsVoiceId = json.elevenLabsVoiceId;

			const requiredNonNullFields = ['id', 'name', 'personality', 'messageLog', 'todos'];
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

	/**
	 * Get the current state of the agent
	 */
	getState(): AgentState {
		return this.state;
	}

	/**
	 * Safely attempt a state transition, throwing an error if invalid
	 */
	private safeTransition(eventType: string): void {
		const validTransitions: Record<AgentState, string[]> = {
			IDLE: ['ACTIVATE_VOICE', 'ACTIVATE_TEXT', 'LEAVE', 'GO_IDLE'],
			VOICE_ACTIVE: ['GO_IDLE', 'START_WORK', 'SWITCH_TO_TEXT'],
			TEXT_ACTIVE: ['GO_IDLE', 'START_WORK', 'SWITCH_TO_VOICE'],
			LEFT_CALL: ['GO_IDLE'],
			WORKING: ['RETURN_TO_VOICE', 'RETURN_TO_TEXT', 'RAISE_HAND'],
			RAISED_HAND: ['RETURN_TO_WORK']
		};

		const currentState = this.state;
		const allowedEvents = validTransitions[currentState];

		if (!allowedEvents.includes(eventType)) {
			throw new Error(
				`Invalid transition: Cannot transition from '${currentState}' with event '${eventType}'. Valid events are: ${allowedEvents.join(
					', '
				)}`
			);
		}

		// Send a proper event object to the state machine
		const event = { type: eventType };
		this.stateMachine.send(event);
	}

	/**
	 * State transition methods
	 */
	makeIdle(): void {
		this.safeTransition('GO_IDLE');
	}

	makeVoiceActive(): void {
		this.safeTransition('ACTIVATE_VOICE');
	}

	makeTextActive(): void {
		this.safeTransition('ACTIVATE_TEXT');
		this.initiateTextChat();
	}

	leaveCall(): void {
		this.safeTransition('LEAVE');
		addAiLeaveEvent({ name: this.getName(), model: 'gpt-4o' });
	}

	startWorking(): void {
		this.safeTransition('START_WORK');
	}

	raiseHand(): void {
		this.safeTransition('RAISE_HAND');
	}

	returnToVoice(): void {
		this.safeTransition('RETURN_TO_VOICE');
	}

	returnToText(): void {
		this.safeTransition('RETURN_TO_TEXT');
	}

	returnToWork(): void {
		this.safeTransition('RETURN_TO_WORK');
	}

	switchToText(): void {
		this.safeTransition('SWITCH_TO_TEXT');
	}

	switchToVoice(): void {
		this.safeTransition('SWITCH_TO_VOICE');
	}
}
