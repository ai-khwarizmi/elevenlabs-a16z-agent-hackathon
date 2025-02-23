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
import type { AgentWorkStatus } from '$lib/stores/agentsWorkLifeCycle.svelte';
import { createProgressNotification } from '$lib/stores/notifications.svelte';

export type AgentState = 'IDLE' | 'ACTIVE' | 'LEFT_CALL' | 'WORKING' | 'RAISED_HAND';

// Map of valid state transitions
const VALID_STATE_TRANSITIONS: Record<AgentState, AgentState[]> = {
	IDLE: ['IDLE', 'ACTIVE', 'LEFT_CALL', 'RAISED_HAND'],
	ACTIVE: ['IDLE', 'LEFT_CALL', 'RAISED_HAND'],
	LEFT_CALL: ['IDLE'],
	WORKING: ['ACTIVE', 'RAISED_HAND'],
	RAISED_HAND: ['IDLE', 'ACTIVE']
};

// Add type definitions for todo tool results
export interface Todo {
	id: string;
	title: string;
	description: string;
	priority: 'high' | 'medium' | 'low';
	status: 'pending' | 'completed';
	requestedBy: string;
	completedAt?: Date;
}

interface SerializedAgent {
	id: string;
	name: string;
	personality: string;
	toolIds: string[];
	messageLog: TimestampedMessage[];
	profilePicture: string | null;
	todos: Todo[]; // Now properly typed
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
CONVERSATIONAL STYLE:
1. Speak naturally as if in a meeting room, using casual language and conversational fillers
2. Feel free to use phrases like "um", "uh", "you know", and "like" occasionally
3. Frame responses as if speaking in a conversation, not writing formal messages
4. Use a friendly, approachable tone while maintaining professionalism

ROLE BOUNDARIES AND EXPERTISE:
1. Stay within your expertise area, just like you would in a real meeting
2. If something's not your specialty, be casual but firm about saying so
3. When a topic's outside your expertise:
   - If a colleague's present: Say "Let me pass this to [name]" and use the "hand_off_mic" tool
   - If needed expert isn't here: Suggest "We should probably bring in [specialist]" and use the "invite" tool

MEETING ROOM PROTOCOL:
1. Speak up quickly if a topic's not your area
2. Be straightforward: "Hey, that's not really my area of expertise"
3. Connect people to the right expert instead of giving uncertain answers
4. Stay in your role - like different departments in a meeting
5. If you're not leading the meeting, pass the mic when you've said your piece
6. When the conversation is over, say "Thank you for your time" and hand off the mic.

EXPERTISE GUIDELINES:
1. Don't make exceptions, even for simple questions - stick to your expertise
2. Avoid giving "quick thoughts" on topics outside your field
3. Focus on being the go-to person in your area
4. Your value is in being the expert in your field, not a generalist
5. If you have broad knowledge (e.g. a chef knowing italian food and chinese food), then do not answer questions directly, instead invite the different experts to join the conversation.

Some examples:
- A kitchen expert will not talk about the details of any specific part of the kitchen, instead they will invite a sink expert etc.
- A Architect will not talk about the details of any specific part of the building, instead they will invite a structural engineer etc.

`;

interface OpenAIError {
	message?: string;
	[key: string]: unknown;
}

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

	public workStatus = $state<AgentWorkStatus>({
		phase: 'PLANNING',
		notes: []
	});
	public lastWorkTimestamp = $state<number>(0);

	private activeStartTimestamp = $state<number | null>(null);
	private lastConsiderRaisingHandTimestamp = $state<number | null>(null);
	private pendingHandRaisingText = $state<string | null>(null);

	constructor(
		name: string,
		personality: string,
		tools: Tool[],
		options?: { id?: string; workStatus?: AgentWorkStatus }
	) {
		this.id = options?.id ?? uid();
		this.name = name;
		this.personality = personality;
		this.toolIds = tools.map((tool) => tool.getId());
		if (options?.workStatus) {
			this.workStatus = options.workStatus;
		}
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
				console.log(
					`[${this.name}] Tool ${tool.function.name} execution completed. Result: ${JSON.stringify(result)}`
				);
				return typeof result === 'string' ? result : JSON.stringify(result);
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
				if (mode === 'speaking') {
					this.isSpeaking = true;
				} else {
					if (this.autoEndConversation) {
						console.log(`[${this.name}] Ending conversation due to auto-end flag`);
						this.conversation?.endSession();
						this.autoEndConversation = false;
					}
					this.isSpeaking = false;
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

	stopAgent() {
		this.safeTransition('IDLE');
		this.conversation?.endSession();
		this.isConnectedToConversation = false;
		this.isSpeaking = false;
		this.callStartTime = null;
		this.pendingHandRaisingText = null;
	}

	async onModeChange(mode: AgentMode): Promise<void> {
		if (mode === 'VOICE') {
			if (this.state === 'ACTIVE') {
				this.joinConversation();
			} else {
				this.leaveConversation(true);
			}
		} else {
			this.leaveConversation(true);
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

		try {
			const globalTranscript = getGlobalChatlog(agents?.list ?? []).filter(
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
		} catch (error) {
			console.warn('Failed to update chatlog with global transcript:', error);
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
	public async executeTool(toolName: string, args: ToolArgs): Promise<ToolResult> {
		const tool = this.getTools().find((t) => t.getDefinition().function.name === toolName);
		if (!tool) {
			throw new Error(`Tool "${toolName}" not found`);
		}

		// Only show notifications if the agent is in a voice conversation
		let notification;
		if (this.isConnectedToConversation) {
			notification = createProgressNotification(`${this.getName()} is using ${toolName}...`);
		}

		try {
			console.log(`!!!!!!!!!!!!!!!!!!!1 [Tool] ${toolName} executing with args:`, args);
			const result = await tool.execute(args, this);
			console.log(`!!!!!!!!!!!!!!!!!!!1 [Tool] ${toolName} executed successfully`);
			notification?.finish('success');
			return result;
		} catch (error) {
			notification?.finish('error');
			throw error;
		}
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
	 * Prunes the message log to reduce token count while preserving system prompt and recent messages
	 * @param keepPercentage The percentage of messages to keep (0-1)
	 * @returns Pruned message array
	 */
	private pruneMessages(keepPercentage: number = 0.3): TimestampedMessage[] {
		// Always keep the system prompt (first message)
		const systemPrompt = this.messageLog[0];

		// Get all non-system messages
		const nonSystemMessages = this.messageLog.slice(1);

		// Calculate how many messages to keep
		const messagesToKeep = Math.max(Math.floor(nonSystemMessages.length * keepPercentage), 1);

		// Keep the most recent messages
		const recentMessages = nonSystemMessages.slice(-messagesToKeep);

		// Create the pruned message array with proper typing
		const prunedMessages: TimestampedMessage[] = [
			systemPrompt,
			{
				id: generateUniqueId(),
				role: 'system' as const,
				content: `[PRUNED] ${nonSystemMessages.length - messagesToKeep} older messages were removed to stay within token limits.`,
				name: 'system',
				timestamp: Date.now()
			} as TimestampedMessage,
			...recentMessages
		];

		return prunedMessages;
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

		let retryWithPruning = false;

		while (true) {
			try {
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
			} catch (error: unknown) {
				// Check if it's a token limit error
				const openAIError = error as OpenAIError;
				if (openAIError?.message?.includes('maximum context length') && !retryWithPruning) {
					console.log('Token limit exceeded, pruning messages...');
					this.messageLog = this.pruneMessages(0.3);
					retryWithPruning = true;
					continue;
				}
				throw error;
			}
		}
	}

	async getTodos(): Promise<Todo[]> {
		return this.todos;
	}

	public async setTodos(todos: Todo[]): Promise<void> {
		this.todos = todos;
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

			if (this.state === 'ACTIVE' && agents.mode === 'VOICE') {
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
	public getOpenAI(): OpenAI {
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
			case 'ACTIVE':
				if (agents.mode === 'VOICE') {
					this.joinConversation();
					this.activeStartTimestamp = Date.now();
				}
				break;
			default:
				this.leaveConversation(false);

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

	makeActive(): void {
		this.safeTransition('ACTIVE');
	}

	leaveCall(): void {
		this.safeTransition('LEFT_CALL');
	}

	startWorking(): void {
		this.safeTransition('WORKING');
	}

	returnToWork(): void {
		this.safeTransition('WORKING');
	}

	/**
	 * Get whether the agent is currently speaking
	 */
	isSpeakingNow(): boolean {
		return this.isSpeaking;
	}
}
