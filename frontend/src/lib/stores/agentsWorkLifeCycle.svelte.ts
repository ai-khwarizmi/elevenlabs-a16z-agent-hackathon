import type { Agent } from '$lib/utils/agent.svelte';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

type AgentWorkPhase = 'PLANNING' | 'DOING';

export type AgentWorkStatus = {
	phase: AgentWorkPhase;
	notes: string[];
};

async function agentDoPlanning(agent: Agent) {
	const todoList = agent.getTodos();
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

	while (hasToolCalls) {
		const toolDefinitions = agent.getToolDefinitions();
		console.log('[PLANNING-PHASE] Tool definitions:', toolDefinitions);
		const aiResponse = await agent.getOpenAI().chat.completions.create({
			model: 'gpt-4o',
			messages: currentMessages,
			tools: agent.getToolDefinitions(),
			tool_choice: 'auto',
			parallel_tool_calls: true
		});

		const assistantMessage = aiResponse.choices[0].message;
		console.log('[PLANNING-PHASE] Assistant message:', assistantMessage);
		if (!assistantMessage.tool_calls) {
			hasToolCalls = false;
			break;
		}

		currentMessages.push(assistantMessage);

		// Check if there are tool calls in the response
		const toolCalls = assistantMessage.tool_calls;
		console.log('[PLANNING-PHASE] Tool calls:', toolCalls?.length);
		if (!toolCalls || toolCalls.length === 0) {
			hasToolCalls = false;
			break;
		}

		// Process each tool call
		for (const toolCall of toolCalls) {
			console.log('[PLANNING-PHASE] Executing tool call:', toolCall);
			const result = await agent.executeTool(
				toolCall.function.name,
				JSON.parse(toolCall.function.arguments)
			);
			console.log('[PLANNING-PHASE] Tool call result:', result);
			currentMessages.push({
				role: 'tool',
				tool_call_id: toolCall.id,
				content: JSON.stringify(result)
			});
		}
	}

	agent.workStatus.phase = 'DOING';
}

async function agentDoDoing(agent: Agent) {
	const todos = agent.getTodos();
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
	`;

	console.log('[DOING-PHASE] Work prompt:', workPrompt);

	const currentMessages: ChatCompletionMessageParam[] = [
		{
			role: 'system',
			content: workPrompt
		},
		{
			role: 'user',
			content: `The current conversation: <conversation>${JSON.stringify(
				agent.getMessageLog()
			)}</conversation>`
		}
	];

	let hasToolCalls = true;
	let todoCompleted = false;

	const maxIterations = 15;
	let iterations = 0;
	while (hasToolCalls && !todoCompleted && maxIterations > 0) {
		iterations++;
		const toolDefinitions = agent.getToolDefinitions();
		console.log('[DOING-PHASE] Tool definitions:', toolDefinitions);

		const aiResponse = await agent.getOpenAI().chat.completions.create({
			model: 'gpt-4o',
			messages: currentMessages,
			tools: agent.getToolDefinitions(),
			tool_choice: 'auto',
			parallel_tool_calls: true
		});

		const assistantMessage = aiResponse.choices[0].message;
		console.log('[DOING-PHASE] Assistant message:', assistantMessage);
		if (!assistantMessage.content) {
			hasToolCalls = false;
			continue;
		}

		currentMessages.push(assistantMessage);

		// Check if there are tool calls in the response
		const toolCalls = assistantMessage.tool_calls;
		if (!toolCalls || toolCalls.length === 0) {
			hasToolCalls = false;
			continue;
		}

		// Process each tool call
		console.log('[DOING-PHASE] Tool calls:', toolCalls.length);
		for (const toolCall of toolCalls) {
			console.log('[DOING-PHASE] Executing tool call:', toolCall);
			const result = await agent.executeTool(
				toolCall.function.name,
				JSON.parse(toolCall.function.arguments)
			);
			console.log('[DOING-PHASE] Tool call result:', result);

			// Check if this was a todo update that marked our current todo as complete
			if (toolCall.function.name === 'manage_todos') {
				const args = JSON.parse(toolCall.function.arguments);
				if (args.action === 'update' && args.id === todo.id && args.status === 'completed') {
					todoCompleted = true;
					console.log('[DOING-PHASE] Todo completed:', todo);
					agent.completeTodo(todo.id);
					agent.workStatus.phase = 'PLANNING';
				}
			}

			currentMessages.push({
				role: 'tool',
				content: JSON.stringify(result),
				tool_call_id: toolCall.id
			});
		}

		console.log(`[DOING-PHASE] Iterations for agent ${agent.getName()}: ${iterations}`);
		if (iterations >= maxIterations) {
			console.log('[DOING-PHASE] Max iterations reached, stopping', currentMessages);
			break;
		} else {
			currentMessages.push({
				role: 'user',
				content: `
				Please make sure to finish the todo, remaining iterations: ${maxIterations - iterations}
				`
			});
		}
		await new Promise((resolve) => setTimeout(resolve, 300));
	}
}

const MIN_TIME_BETWEEN_WORK_CYCLES = 15 * 1000;

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

	switch (agent.workStatus.phase) {
		case 'PLANNING':
			await agentDoPlanning(agent);
			break;
		case 'DOING':
			await agentDoDoing(agent);
			break;
	}
}
