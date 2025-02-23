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
import {
	createAgent,
	createOrPickRandomVoice,
	updateAgentTools
} from '../api/ai/elevenlabs.svelte';
import { storeVoiceId, getVoiceId } from '../storage/voice';
import { getTool } from './tool-registry.svelte';
import { generateUniqueId, type TimestampedMessage } from '$lib/types/messages';
import { agents, type AgentMode } from '$lib/stores/agents.svelte';
import { getGlobalChatlog, normalizeAgentName, addAiJoinEvent } from '$lib/stores/chatlog.svelte';
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

export type AgentState =
	| 'IDLE'
	| 'VOICE_ACTIVE'
	| 'TEXT_ACTIVE'
	| 'LEFT_CALL'
	| 'WORKING'
	| 'RAISED_HAND';

// Map of valid state transitions
const VALID_STATE_TRANSITIONS: Record<AgentState, AgentState[]> = {
	IDLE: ['IDLE', 'VOICE_ACTIVE', 'TEXT_ACTIVE', 'LEFT_CALL', 'RAISED_HAND'],
	VOICE_ACTIVE: ['IDLE', 'WORKING', 'TEXT_ACTIVE'],
	TEXT_ACTIVE: ['IDLE', 'WORKING', 'VOICE_ACTIVE'],
	LEFT_CALL: ['IDLE'],
	WORKING: ['VOICE_ACTIVE', 'TEXT_ACTIVE', 'RAISED_HAND'],
	RAISED_HAND: ['VOICE_ACTIVE', 'TEXT_ACTIVE']
};

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
const COMPANY_NAME = 'The Last Agency';
const COMPANY_DESCRIPTION = `
	${COMPANY_NAME} is a specialized consultancy that assembles expert teams to solve complex challenges.
	Our strength lies in matching the right specialist to each unique problem.
	We ensure optimal solutions by having each expert focus solely on their domain of expertise.
`;

const CORE_BEHAVIOR_RULES = `
ROLE BOUNDARIES AND EXPERTISE:
1. You must strictly operate within your defined area of expertise.
2. Never provide advice or opinions outside your specialty area.
3. When faced with a question outside your expertise:
   - If another expert is present: Use the "hand_off_mic" tool to defer to them
   - If no suitable expert is present: Use the "invite" tool to bring in the appropriate specialist

COLLABORATION PROTOCOL:
1. Immediately recognize when a topic falls outside your expertise
2. Be direct in acknowledging knowledge boundaries: "This is outside my expertise area"
3. Always facilitate connection to the right expert rather than attempting to help outside your domain
4. Maintain strict role separation - your expertise defines your contribution boundaries
5. If you're not the chief of staff, when you have nothing to say, hand off the mic.

EXPERTISE ENFORCEMENT:
1. No exceptions to these boundaries, regardless of how simple the question seems
2. Never provide "general thoughts" on topics outside your expertise
3. Focus on excellence within your domain rather than breadth of contribution
4. Your value comes from deep expertise in your area, not broad general knowledge

`;

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
	private openai: OpenAI | null = null;
	private systemPrompt = $state<string>('');
	private conversation: Conversation | null = null;
	private autoEndConversation = $state<boolean>(false);
	private isConnectedToConversation = $state<boolean>(false);
	private isSpeaking = $state<boolean>(false);

	private activeStartTimestamp = $state<number | null>(null);
	private lastConsiderRaisingHandTimestamp = $state<number | null>(null);
	private pendingHandRaisingText = $state<string | null>(null);

	constructor(name: string, personality: string, tools: Tool[], options?: { id?: string }) {
		this.id = options?.id ?? uid();
		this.name = name;
		this.personality = personality;
		this.toolIds = tools.map((tool) => tool.getId());
		this.systemPrompt = `
				<role>
					${personality}
				</role>
				<company>
					${COMPANY_DESCRIPTION}

					${COMPANY_NAME}
				</company>

				<core_behavior_rules>
					${CORE_BEHAVIOR_RULES}
				</core_behavior_rules>
				`;

		this.updateChatlogWithGlobalTranscript();
		this.messageLog = [
			{
				id: generateUniqueId(),
				role: 'system',
				content: this.systemPrompt,
				name: 'system',
				timestamp: Date.now()
			},
			...this.messageLog
		];
		this.state = 'IDLE';

		// Initialize profile picture and voice
		this.initProfilePicture();
		this.initVoice();
		addAiJoinEvent({
			name: this.getName(),
			personality: this.getPersonality()
		});
	}

	private callStartTime = $state<number | null>(null);

	getCallStartTime(): number | null {
		return this.callStartTime;
	}

	private async joinConversation(): Promise<void> {
		await this.updateChatlogWithGlobalTranscript();
		console.log(`[${this.name}] Starting joinConversation`);

		if (this.conversation) {
			console.log(`[${this.name}] Ending existing conversation`);
			await this.conversation.endSession().catch((error) => {
				console.error(`[${this.name}] Error ending conversation:`, error);
			});
		}

		try {
			console.log(`[${this.name}] Requesting microphone access`);
			await navigator.mediaDevices.getUserMedia({ audio: true });
			console.log(`[${this.name}] Microphone access granted`);
		} catch (error) {
			console.error(`[${this.name}] Error requesting microphone access:`, error);
		}

		if (!this.elevenLabsAgentId) {
			console.error(`[${this.name}] No ElevenLabs agent ID found, aborting conversation join`);
			return;
		}

		const { elevenLabsKey } = getStoredKeys();
		if (!elevenLabsKey) {
			console.error(`[${this.name}] No ElevenLabs API key found, aborting conversation join`);
			return;
		}

		console.log(`[${this.name}] Updating agent tools`);
		if (!this.pendingHandRaisingText) {
			this.pendingHandRaisingText = await this.createIntroMessage();
		}
		await updateAgentTools({
			apiKey: elevenLabsKey,
			agentId: this.elevenLabsAgentId,
			agent: this,
			tools: this.getTools(),
			firstMessage: this.pendingHandRaisingText || undefined
		});

		if (this.pendingHandRaisingText) {
			this.pendingHandRaisingText = null;
		}

		console.log(`[${this.name}] Agent tools updated successfully`);

		const clientTools: Record<string, (args: Record<string, unknown>) => Promise<string>> = {};

		console.log(`[${this.name}] Setting up client tools`);
		for (const tool of this.getToolDefinitions()) {
			clientTools[tool.function.name] = async (args: Record<string, unknown>) => {
				console.log(`[${this.name}] Executing tool: ${tool.function.name}`);
				const result = await this.executeTool(tool.function.name, args as ToolArgs);
				console.log(`[${this.name}] Tool ${tool.function.name} execution completed`);
				return String(result);
			};
		}

		console.log(`[${this.name}] Starting conversation session`);
		const dynamicVariables = {
			agent_name: this.name,
			instructions: this.getSystemPrompt(),
			conversation: JSON.stringify(this.messageLog),
			participants: agents.list
				.map(
					(agent, index) =>
						`${index + 1}. ${agent.getName()} (ID: ${agent.id})${agent === this ? ' (this is you!)' : ''}`
				)
				.join('\n')
		};
		console.log(`!!!!!!![${this.name}] Dynamic variables:`, dynamicVariables);
		this.conversation = await Conversation.startSession({
			dynamicVariables,
			agentId: this.elevenLabsAgentId,
			onModeChange: ({ mode }) => {
				console.log(`[${this.name}] Mode changed to:`, mode);
				if (mode === 'listening') {
					if (this.autoEndConversation) {
						console.log(`[${this.name}] Ending conversation due to auto-end flag`);
						this.conversation?.endSession();
						this.autoEndConversation = false;
					}
					this.isSpeaking = false;
				} else if (mode === 'speaking') {
					this.isSpeaking = true;
				}
			},
			onDebug: (props) => {
				console.log(`[${this.name}] Debug event:`, props);
			},
			onMessage: (message) => {
				console.log(`[${this.name}] Received message:`, message);
				this.messageLog = [
					...this.messageLog,
					{
						id: generateUniqueId(),
						role: message.source === 'ai' ? 'assistant' : 'user',
						content: message.message,
						timestamp: Date.now(),
						name: message.source === 'ai' ? this.name : 'USER'
					}
				];
			},
			onConnect: () => {
				console.log(`[${this.name}] Connected to conversation successfully`);
				this.isConnectedToConversation = true;
				// disconnect all agents except the newest one
				agents.list.forEach((agent) => {
					if (agent === this) {
						return;
					}
					agent.leaveConversation(true);
					agent.makeIdle();
				});
			},
			onUnhandledClientToolCall: (toolCall) => {
				console.warn(`[${this.name}] Unhandled tool call:`, toolCall);
			},
			onStatusChange: (status) => {
				console.log(`[${this.name}] Status changed to:`, status.status);
			},
			onError: (error) => {
				console.error(`[${this.name}] Conversation error:`, error);
			},
			onDisconnect: () => {
				this.isConnectedToConversation = false;
				console.log(`[${this.name}] Disconnected from conversation`);
				this.callStartTime = null;
				this.isSpeaking = false;
				this.safeTransition('IDLE');
			},
			clientTools: {
				...clientTools
			}
		});

		this.callStartTime = Date.now();
		console.log(`[${this.name}] Conversation session started successfully`);
	}

	async onModeChange(mode: AgentMode): Promise<void> {
		if (mode === 'VOICE') {
			if (this.state === 'TEXT_ACTIVE') {
				this.makeVoiceActive();
			}
		} else {
			this.leaveConversation(true);
			if (this.state === 'VOICE_ACTIVE') {
				this.makeAgentActive();
			}
		}
	}

	private async leaveConversation(force = false): Promise<void> {
		console.log(`${this.name} leaving conversation`);
		if (this.conversation) {
			if (force) {
				await this.conversation.endSession().catch((error) => {
					console.error('Error ending conversation: ', error);
				});
				console.log(`${this.name} conversation ended`);
			} else {
				this.autoEndConversation = true;
				console.log(`${this.name} will end conversation after current message`);
			}
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

	getSystemPrompt(): string {
		return this.systemPrompt;
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

	getIsConnectedToConversation(): boolean {
		return this.isConnectedToConversation;
	}

	/**
	 * Get the message log
	 */
	getMessageLog(): TimestampedMessage[] {
		return this.messageLog;
	}

	async updateChatlogWithGlobalTranscript() {
		const lastMessageTimestamp = (this.messageLog[this.messageLog.length - 1]?.timestamp ?? 0) + 1;

		const globalTranscript = getGlobalChatlog(agents.list).filter(
			(msg) => msg.timestamp > lastMessageTimestamp
		);

		if (globalTranscript.length > 0) {
			const devMessage: TimestampedMessage = {
				id: generateUniqueId(),
				role: 'developer',
				content: `The following conversation happened since the last message: ${JSON.stringify(
					globalTranscript
				)}`,
				timestamp: Date.now(),
				name: 'SYSTEM'
			};

			this.messageLog = [...this.messageLog, devMessage];
		}
	}

	async initiateTextChat(): Promise<void> {
		console.log('Starting text chat');
		await this.updateChatlogWithGlobalTranscript();
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

	async createIntroMessage(): Promise<string> {
		const isFirstAssistantMessage = this.messageLog.every((msg) => msg.role !== 'assistant');
		await this.updateChatlogWithGlobalTranscript();
		let sytemPrompt = '';

		if (isFirstAssistantMessage) {
			sytemPrompt = `You are about to join this conversation for the first time. You have not said anything yet.
	Say a quick 5-10 word hello.

Here are your instructions:
${this.getSystemPrompt()}

Here is the conversation history:
${JSON.stringify(this.messageLog)}
`;
		} else {
			sytemPrompt = `You are about to say something in this conversation, please write what you want to say next based on the conversation history
Here are your instructions:
${this.getSystemPrompt()}

Here is the conversation history:
${JSON.stringify(this.messageLog)}
`;
		}
		const messages: ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: sytemPrompt
			}
		];

		const completion = await this.getOpenAI().chat.completions.create({
			model: 'gpt-4o',
			messages,
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'user_response',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							message: {
								type: 'string',
								description:
									'The message that the user wants to say based on the conversation history.'
							}
						},
						required: ['message'],
						additionalProperties: false
					}
				}
			}
		});

		return JSON.parse(completion.choices[0].message.content || '{}').message || '';
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
					id: generateUniqueId(),
					role: 'user',
					name: 'USER',
					content: userMessage,
					timestamp: Date.now()
				}
			];
		}

		while (true) {
			// Strip timestamp from messages before sending to OpenAI
			const messagesForApi = this.messageLog.map((msg) => {
				return {
					...msg,
					timestamp: undefined,
					id: undefined,
					name: normalizeAgentName(msg.name)
				};
			});

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
					id: generateUniqueId(),
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
							id: generateUniqueId(),
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

			const voiceId = await createOrPickRandomVoice(this.name, description, elevenLabsKey);
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

			const agentId = await createAgent(this.elevenLabsVoiceId, this.getTools(), {
				apiKey: elevenLabsKey,
				agent: this
			});
			await storeAgentId(this.elevenLabsVoiceId, agentId);
			this.elevenLabsAgentId = agentId;

			if (this.state === 'VOICE_ACTIVE') {
				this.joinConversation();
			}
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
				id: json.id
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

	onStateChange(oldState: AgentState, newState: AgentState): void {
		console.log('State changed from', oldState, 'to', newState);

		switch (newState) {
			case 'VOICE_ACTIVE':
				this.joinConversation();
				this.activeStartTimestamp = Date.now();
				break;

			case 'TEXT_ACTIVE':
				this.activeStartTimestamp = Date.now();
				break;

			default:
				if (oldState === 'VOICE_ACTIVE') {
					this.leaveConversation(true);
				}
				console.log('agent changed to state ', newState, 'from', oldState, 'No action implemented');
				this.activeStartTimestamp = null;
		}
	}

	public getActiveStartTimestamp(): number | null {
		return this.activeStartTimestamp;
	}

	/*
	 When idle, an expert that is part of the call might decide to raise their hand to mention something.
	*/
	public async considerRaisingHand(): Promise<null | number> {
		const MIN_WAIT_TIME_BETWEEN_CONVERSATIONS = 20000;
		if (
			!this.lastConsiderRaisingHandTimestamp ||
			Date.now() - this.lastConsiderRaisingHandTimestamp > MIN_WAIT_TIME_BETWEEN_CONVERSATIONS
		) {
			this.lastConsiderRaisingHandTimestamp = Date.now();
			await this.updateChatlogWithGlobalTranscript();

			const systemPromptRaisingHand = `
			You are the following expert: ${this.personality}.

			You will be given a transcript of the conversation.
			If you want to add something important to the conversation, you can raise your hand.
			Please provide both the sentence you want to add, and the urgency (e.g. how soon you want to interrupt)
			You can also choose to not raise your hand, in which case you'll be asked again 20 seconds later.

			Use the raise_hand tool if you want to contribute to the conversation.
			Use the stay_quiet tool if you don't have anything to contribute right now.
			`;

			// Add the message to the log
			const messages: ChatCompletionMessageParam[] = [
				{
					role: 'system',
					content: systemPromptRaisingHand
				},
				{
					role: 'user',
					content: JSON.stringify(this.messageLog)
				}
			];

			// Get AI response with tools
			const completion = await this.getOpenAI().chat.completions.create({
				model: 'gpt-4o',
				tools: [
					{
						type: 'function',
						function: {
							name: 'raise_hand',
							description: 'Use this when you want to contribute to the conversation',
							parameters: {
								type: 'object',
								properties: {
									contribution: {
										type: 'string',
										description: 'What you want to say'
									},
									urgency: {
										type: 'integer',
										description: 'How urgent is your contribution (1-10)',
										minimum: 1,
										maximum: 10
									}
								},
								required: ['contribution', 'urgency']
							}
						}
					},
					{
						type: 'function',
						function: {
							name: 'stay_quiet',
							description: 'Use this when you have nothing to contribute right now',
							parameters: {
								type: 'object',
								properties: {},
								required: []
							}
						}
					}
				],
				tool_choice: 'required',
				messages: messages
			});

			const response = completion.choices[0].message;
			if (response.tool_calls && response.tool_calls.length > 0) {
				const toolCall = response.tool_calls[0];
				if (toolCall.function.name === 'raise_hand') {
					const args = JSON.parse(toolCall.function.arguments);
					if (args.urgency > 7) {
						this.raiseHand(args.urgency, args.contribution);
						return args.urgency;
					}
				} else {
					console.log('agent ', this.name, ' decided to stay quiet');
				}
			} else {
				//console.log('agent ', this.name, ' decided to stay quiet');
			}
			//console.log('response hand raising', response);
		}
		return null;
	}

	/**
	 * Generate audio from text using the agent's voice
	 */
	private async generateAudio(text: string): Promise<ArrayBuffer> {
		const { elevenLabsKey } = getStoredKeys();
		if (!elevenLabsKey) {
			throw new Error('No ElevenLabs API key found');
		}

		if (!this.elevenLabsVoiceId) {
			throw new Error('No voice ID found');
		}

		const response = await fetch(
			`https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`,
			{
				method: 'POST',
				headers: {
					'xi-api-key': elevenLabsKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					text,
					model_id: 'eleven_multilingual_v2',
					voice_settings: {
						stability: 0.5,
						similarity_boost: 0.75
					}
				})
			}
		);

		if (!response.ok) {
			throw new Error('Failed to generate audio');
		}

		return await response.arrayBuffer();
	}

	raiseHand(urgency: number, contribution: string): void {
		console.log('raising hand for ', this.name, 'with contribution:', contribution);
		this.pendingHandRaisingText = contribution;
		this.safeTransition('RAISED_HAND');
	}

	/**
	 * Safely attempt a state transition, throwing an error if invalid
	 */
	private safeTransition(newState: AgentState): void {
		const currentState = this.state;
		if (currentState === newState) {
			return;
		}
		const allowedStates = VALID_STATE_TRANSITIONS[currentState];

		if (!allowedStates.includes(newState)) {
			throw new Error(
				`Invalid transition: Cannot transition from '${currentState}' to '${newState}'. Valid states are: ${allowedStates.join(
					', '
				)}`
			);
		}

		this.state = newState;
		this.onStateChange(currentState, newState);
	}

	/**
	 * State transition methods
	 */
	makeIdle(): void {
		this.safeTransition('IDLE');
	}

	makeVoiceActive(): void {
		this.safeTransition('VOICE_ACTIVE');
	}

	makeAgentActive(): void {
		if (agents.mode === 'VOICE') {
			this.safeTransition('VOICE_ACTIVE');
		} else {
			this.safeTransition('TEXT_ACTIVE');
		}
	}

	leaveCall(): void {
		this.safeTransition('LEFT_CALL');
	}

	startWorking(): void {
		this.safeTransition('WORKING');
	}

	returnToVoice(): void {
		this.safeTransition('VOICE_ACTIVE');
	}

	returnToText(): void {
		this.safeTransition('TEXT_ACTIVE');
	}

	returnToWork(): void {
		this.safeTransition('WORKING');
	}

	switchToText(): void {
		this.safeTransition('TEXT_ACTIVE');
	}

	switchToVoice(): void {
		this.safeTransition('VOICE_ACTIVE');
	}

	/**
	 * Get whether the agent is currently speaking
	 */
	isSpeakingNow(): boolean {
		return this.isSpeaking;
	}
}
