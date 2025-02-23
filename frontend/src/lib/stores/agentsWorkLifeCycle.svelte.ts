import type { Agent } from '$lib/utils/agent.svelte';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

type AgentWorkPhase = 'PLANNING' | 'DOING' | 'REVIEWING';

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
		if (!assistantMessage.content) continue;

		currentMessages.push(assistantMessage);

		// Check if there are tool calls in the response
		const toolCalls = assistantMessage.tool_calls;
		if (!toolCalls || toolCalls.length === 0) {
			hasToolCalls = false;
			continue;
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
				role: 'function',
				name: toolCall.function.name,
				content: JSON.stringify(result)
			});
		}
	}

	agent.workStatus.phase = 'DOING';
}

async function agentDoDoing(agent: Agent) {
	const todos = agent.getTodos();
	if (todos.length === 0) {
		agent.workStatus.phase = 'REVIEWING';
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
		agent.workStatus.phase = 'REVIEWING';
		return;
	}

	agent.workStatus.phase = 'REVIEWING';
}

async function agentDoReviewing(agent: Agent) {
	agent.workStatus.phase = 'PLANNING';
}

const MIN_TIME_BETWEEN_WORK_CYCLES = 15 * 1000;

export async function agentDoWork(agent: Agent) {
	return;
	const lastWorkTimestamp = agent.lastWorkTimestamp;
	const timeSinceLastWork = Date.now() - lastWorkTimestamp;
	if (timeSinceLastWork < MIN_TIME_BETWEEN_WORK_CYCLES) {
		console.log('[AGENT-DO-WORK] Not enough time has passed since last work cycle');
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
		case 'REVIEWING':
			await agentDoReviewing(agent);
			break;
	}
}
