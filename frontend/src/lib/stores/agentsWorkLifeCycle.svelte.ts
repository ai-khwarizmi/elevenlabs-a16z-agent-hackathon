import type { Agent } from '$lib/utils/agent.svelte';
import type {
	ChatCompletionMessageParam,
	ChatCompletionSystemMessageParam,
	ChatCompletionUserMessageParam
} from 'openai/resources/chat/completions';
import { addDeveloperEvent } from './chatlog.svelte';
import { showNotification, createProgressNotification } from './notifications.svelte';
import type { OpenAIError } from 'openai';

type AgentWorkPhase = 'PLANNING' | 'DOING';

export type AgentWorkStatus = {
	phase: AgentWorkPhase;
	notes: string[];
};

async function agentDoPlanning(agent: Agent) {
	const notification = createProgressNotification(`${agent.getName()} is planning next actions...`);

	try {
		const todoList = await agent.getTodos();
		const planningPrompt = `
		You are:
		<role>
		${agent.getPersonality()}
		</role>

		1. You will be given a conversation with you and your team.
		2. Use your todo tool. You review the conversation, and add any actionable items to your todo list.
		3. Those must ALL be items that are useful to the user, even those maybe not directly mentioned in the conversation. But they must be relevant.
		4. All todos must be solvable using the tools available to you.
		5. Do not duplicate todos.
		6. Do not add todos that are not related to the conversation.
		7. NEVER add todos that are not related to your role. You mist strictly stick to your expertise.
		8. You must never have more than 5 uncompleted todos at any time. But you can replace them with new ones.

		Here is your todo list:
		<todoList>
		${todoList.map((todo) => `${todo.title}: ${todo.description}`).join('\n')}
		</todoList>
		`;

		const currentMessages: ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: planningPrompt
			},
			{
				role: 'user',
				content: `The current conversation: <conversation>${JSON.stringify(
					agent.getMessageLog()
				)}</conversation>`
			}
		];

		let hasToolCalls = true;
		let iterations = 0;

		while (hasToolCalls) {
			iterations++;
			notification.updateProgress((iterations / 10) * 100); // Assuming max 10 iterations

			const toolDefinitions = agent.getToolDefinitions();
			console.log(`[PLANNING-PHASE][Iteration ${iterations}] Tool definitions:`, toolDefinitions);
			const aiResponse = await agent.getOpenAI().chat.completions.create({
				model: 'gpt-4o',
				messages: currentMessages,
				tools: agent
					.getToolDefinitions()
					.filter((tool) => !['invite_agent', 'show_dialog'].includes(tool.function.name)),
				tool_choice: 'auto',
				parallel_tool_calls: true
			});

			const assistantMessage = aiResponse.choices[0].message;
			console.log(`[PLANNING-PHASE][Iteration ${iterations}] Assistant message:`, assistantMessage);

			currentMessages.push(assistantMessage);

			// Check if there are tool calls in the response
			const toolCalls = assistantMessage.tool_calls;
			console.log(`[PLANNING-PHASE][Iteration ${iterations}] Tool calls:`, toolCalls?.length);
			if (!toolCalls || toolCalls.length === 0) {
				hasToolCalls = false;
				break;
			}

			// Process each tool call
			for (const toolCall of toolCalls) {
				console.log(`[PLANNING-PHASE][Iteration ${iterations}] Executing tool call:`, toolCall);
				const result = await agent.executeTool(
					toolCall.function.name,
					JSON.parse(toolCall.function.arguments)
				);
				console.log(`[PLANNING-PHASE][Iteration ${iterations}] Tool call result:`, result);
				currentMessages.push({
					role: 'tool',
					tool_call_id: toolCall.id,
					content: JSON.stringify(result)
				});
			}
		}

		notification.finish('success');
		agent.workStatus.phase = 'DOING';
	} catch (error) {
		console.error('[PLANNING-PHASE] Error:', error);
		notification.finish('error');
		throw error;
	}
}

async function agentDoDoing(agent: Agent) {
	const todos = await agent.getTodos();
	if (todos.length === 0) {
		agent.workStatus.phase = 'PLANNING';
		return;
	}

	// Convert priority strings to numerical values for sorting
	const priorityValues = {
		high: 3,
		medium: 2,
		low: 1
	};

	// Find the todo with the highest urgency that isn't done
	const todo = todos
		.sort((a, b) => priorityValues[b.priority] - priorityValues[a.priority])
		.find((todo) => todo.status === 'pending');

	if (!todo) {
		agent.workStatus.phase = 'PLANNING';
		return;
	}

	const notification = createProgressNotification(
		`${agent.getName()} is working on: ${todo.title}`
	);

	try {
		const workPrompt = `
		You are:
		<role>
		${agent.getPersonality()}
		</role>

		You are currently working on the following todo:
		<todo>
		${todo.title}
		${todo.description}
		</todo>

		1. As context you will be given the conversation with you and your team.
		2. You must solve the todo using the tools available to you.
		3. You must update the todo status as you progress.
		4. You must only stop using tools when the todo is complete.
		5. You must use the available tools for saving information. 
		6. You must ensure that if you work on files, you read them before you write to make sure you don't duplicate or overwrite information.
		7. Be detail oriented, and ensure you follow all instructions carefully.
		8. When done, mark the dodo as completed
		`;

		console.log('[DOING-PHASE] Work prompt:', workPrompt);

		const currentMessages: ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: workPrompt
			} as ChatCompletionSystemMessageParam,
			{
				role: 'user',
				content: `The current conversation: <conversation>${JSON.stringify(
					agent.getMessageLog()
				)}</conversation>`
			} as ChatCompletionUserMessageParam
		];

		let todoCompleted = false;
		const maxIterations = 10;
		let iterations = 0;
		let retryWithPruning = false;

		while (!todoCompleted && iterations < maxIterations) {
			iterations++;
			notification.updateProgress((iterations / maxIterations) * 100);

			try {
				const toolDefinitions = agent.getToolDefinitions();
				console.log(`[DOING-PHASE][Iteration ${iterations}] Tool definitions:`, toolDefinitions);

				const aiResponse = await agent.getOpenAI().chat.completions.create({
					model: 'gpt-4o',
					messages: currentMessages,
					tools: agent
						.getToolDefinitions()
						.filter((tool) => !['invite_agent', 'show_dialog'].includes(tool.function.name)),
					tool_choice: 'auto',
					parallel_tool_calls: true
				});

				const assistantMessage = aiResponse.choices[0].message;
				console.log(`[DOING-PHASE][Iteration ${iterations}] Assistant message:`, assistantMessage);

				currentMessages.push(assistantMessage as ChatCompletionMessageParam);
				const toolCalls = assistantMessage.tool_calls;

				// Process each tool call
				console.log(`[DOING-PHASE][Iteration ${iterations}] Tool calls:`, toolCalls?.length);
				for (const toolCall of toolCalls ?? []) {
					console.log(`[DOING-PHASE][Iteration ${iterations}] Executing tool call:`, toolCall);
					const result = await agent.executeTool(
						toolCall.function.name,
						JSON.parse(toolCall.function.arguments)
					);
					console.log(`[DOING-PHASE][Iteration ${iterations}] Tool call result:`, result);

					// Check if this was a todo update that marked our current todo as complete
					if (toolCall.function.name === 'manage_todos') {
						const args = JSON.parse(toolCall.function.arguments);
						if (args.action === 'update' && args.id === todo.id && args.status === 'completed') {
							todoCompleted = true;
							console.log('[DOING-PHASE] Todo completed:', todo);
							// Update todo status through the agent's interface
							await agent.executeTool('manage_todos', {
								action: 'update',
								id: todo.id,
								status: 'completed'
							});
							notification.finish('success');
							const message = `${agent.getName()} has completed: ${todo.title}`;
							addDeveloperEvent(message);
							showNotification(message, 'success');
							agent.workStatus.phase = 'PLANNING';
						}
					}

					currentMessages.push({
						role: 'tool',
						name: agent.getName(),
						tool_call_id: toolCall.id,
						content: JSON.stringify(result)
					} as ChatCompletionMessageParam);
				}

				if (!todoCompleted) {
					currentMessages.push({
						role: 'user',
						content: `Please make sure to finish the todo, remaining iterations: ${maxIterations - iterations}`
					} as ChatCompletionUserMessageParam);
				}
			} catch (error: unknown) {
				const openAIError = error as OpenAIError;
				if (openAIError?.message?.includes('maximum context length') && !retryWithPruning) {
					console.log('[DOING-PHASE] Token limit exceeded, pruning messages...');
					// Get the agent's message log and update our messages
					const messageLog = agent.getMessageLog();
					// Keep only 30% of the messages, but always keep the first (system) message
					const keepCount = Math.max(Math.floor(messageLog.length * 0.3), 1);
					const prunedMessages = [messageLog[0], ...messageLog.slice(-keepCount)];

					// Update our current messages
					currentMessages[1] = {
						role: 'user',
						content: `The current conversation: <conversation>${JSON.stringify(prunedMessages)}</conversation>`
					} as ChatCompletionUserMessageParam;
					retryWithPruning = true;
					continue;
				}
				throw error;
			}

			console.log(
				`[DOING-PHASE][Iteration ${iterations}] Iterations for agent ${agent.getName()}: ${iterations}`
			);
			if (iterations >= maxIterations) {
				console.log('[DOING-PHASE] Max iterations reached, stopping', currentMessages);

				const summary = await agent.getOpenAI().chat.completions.create({
					model: 'gpt-4o',
					messages: [
						{
							role: 'system',
							content: `
							${agent.getName()} tried to complete the following todo: ${todo.title}.
							It has failed for some reason, here is the full conversation of the events. can you give a 5-10 word summary why the task was not completed?
							Here is the conversation:
							<conversation>
							${JSON.stringify(agent.getMessageLog())}
							</conversation>
							`
						}
					]
				});

				const summaryText = summary.choices[0].message.content || 'No summary was provided';
				const message = `${agent.getName()} could not complete: ${todo.title}. ${summaryText}`;
				addDeveloperEvent(message);
				notification.finish('error');
				showNotification(message, 'error');
				break;
			}
		}
	} catch (error) {
		console.error('[DOING-PHASE] Error:', error);
		notification.finish('error');
		throw error;
	}
}

const MIN_TIME_BETWEEN_WORK_CYCLES = 7.5 * 1000;

export async function agentDoWork(agent: Agent) {
	const lastWorkTimestamp = agent.lastWorkTimestamp;
	const timeSinceLastWork = Date.now() - lastWorkTimestamp;
	if (timeSinceLastWork < MIN_TIME_BETWEEN_WORK_CYCLES) {
		return;
	}
	agent.lastWorkTimestamp = Date.now();

	console.log('[AGENT-DO-WORK] Starting work phase:', agent.workStatus.phase);

	// Check if agent has access to the todo list tool
	const hasTodoAccess = agent
		.getTools()
		.some((tool) => tool.getDefinition().function.name === 'manage_todos');
	if (!hasTodoAccess) {
		console.log(
			'[AGENT-DO-WORK] Agent does not have access to todo list tool, skipping work cycle'
		);
		return;
	}

	//if phase is planning, and the todo list has unfinished todos, then skip planning phase
	const todos = await agent.getTodos();
	if (agent.workStatus.phase === 'PLANNING' && todos.some((todo) => todo.status === 'pending')) {
		console.log('[AGENT-DO-WORK] Todo list has unfinished todos, skipping planning phase');
		agent.workStatus.phase = 'DOING';
	}

	switch (agent.workStatus.phase) {
		case 'PLANNING':
			await agentDoPlanning(agent);
			break;
		case 'DOING':
			await agentDoDoing(agent);
			break;
	}
}
