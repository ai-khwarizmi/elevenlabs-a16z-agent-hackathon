import { Tool, type ToolExecuteFunction } from '$lib/utils/tool.svelte';
import { filesystem } from '$lib/stores/filesystem.svelte';
import { normalizeAgentName } from '$lib/stores/chatlog.svelte';

// Helper function to format todo as markdown
function formatTodoAsMarkdown(todo: {
	id: string;
	title: string;
	description: string;
	priority: 'high' | 'medium' | 'low';
	status: 'pending' | 'completed';
	requestedBy: string;
	completedAt?: Date;
}): string {
	const priorityEmoji = {
		high: '🔴',
		medium: '🟡',
		low: '🟢'
	};

	return `## ${todo.title} ${priorityEmoji[todo.priority]}
	
**Status:** ${todo.status === 'completed' ? '✅ Completed' : '⏳ Pending'}
**Priority:** ${todo.priority}
**Requested By:** ${todo.requestedBy}
${todo.completedAt ? `**Completed At:** ${todo.completedAt.toISOString()}` : ''}
**ID:** ${todo.id}

### Description
${todo.description}

---
`;
}

// Helper function to parse markdown to todo
function parseTodoFromMarkdown(markdown: string): Array<{
	id: string;
	title: string;
	description: string;
	priority: 'high' | 'medium' | 'low';
	status: 'pending' | 'completed';
	requestedBy: string;
	completedAt?: Date;
}> {
	const todos = [];
	const sections = markdown.split('---').filter((section) => section.trim());

	for (const section of sections) {
		const titleMatch = section.match(/## (.*?) [🔴🟡🟢]/u);
		const statusMatch = section.match(/\*\*Status:\*\* ([✅⏳] \w+)/u);
		const priorityMatch = section.match(/\*\*Priority:\*\* (\w+)/);
		const requestedByMatch = section.match(/\*\*Requested By:\*\* (.*)/);
		const completedAtMatch = section.match(/\*\*Completed At:\*\* (.*)/);
		const idMatch = section.match(/\*\*ID:\*\* (.*)/);
		const descriptionMatch = section.match(/### Description\n([\s\S]*?)(?=\n\*\*|$)/);

		if (titleMatch && statusMatch && priorityMatch && requestedByMatch && idMatch) {
			const status = statusMatch[1].includes('✅') ? ('completed' as const) : ('pending' as const);
			todos.push({
				id: idMatch[1].trim(),
				title: titleMatch[1].trim(),
				description: descriptionMatch ? descriptionMatch[1].trim() : '',
				priority: priorityMatch[1].toLowerCase() as 'high' | 'medium' | 'low',
				status,
				requestedBy: requestedByMatch[1].trim(),
				completedAt: completedAtMatch ? new Date(completedAtMatch[1].trim()) : undefined
			});
		}
	}

	return todos;
}

/**
 * Tool for managing an agent's todo list
 */
export const todoListTool = new Tool(
	{
		name: 'manage_todos',
		description: 'Manage todo items for task organization and prioritization',
		parameters: {
			type: 'object',
			properties: {
				action: {
					name: 'action',
					type: 'string',
					description: 'Action to perform on todos',
					enum: ['add', 'complete', 'list', 'update_priority']
				},
				title: {
					name: 'title',
					type: 'string',
					description: 'Title of the todo item'
				},
				description: {
					name: 'description',
					type: 'string',
					description: 'Detailed description of the todo item'
				},
				priority: {
					name: 'priority',
					type: 'string',
					description: 'Priority level of the todo item',
					enum: ['high', 'medium', 'low']
				},
				todoId: {
					name: 'todoId',
					type: 'string',
					description: 'ID of the todo item to update'
				},
				requestedBy: {
					name: 'requestedBy',
					type: 'string',
					description: 'Name of the agent or user who requested this todo'
				}
			},
			required: ['action']
		}
	},
	(async (args: Record<string, unknown>, agent) => {
		if (typeof args !== 'object' || args === null) {
			return {
				success: false,
				message: 'Invalid arguments'
			};
		}

		const action = args.action as string;
		const title = args.title as string | undefined;
		const description = args.description as string | undefined;
		const priority = args.priority as 'high' | 'medium' | 'low' | undefined;
		const todoId = args.todoId as string | undefined;
		const requestedBy = args.requestedBy as string | undefined;

		// Ensure /todos directory exists
		await filesystem.mkdirp('/todos');

		// Get agent's todo file path
		const todoFilePath = `/todos/${normalizeAgentName(agent.getName())}.md`;

		// Load existing todos
		let todos: Array<{
			id: string;
			title: string;
			description: string;
			priority: 'high' | 'medium' | 'low';
			status: 'pending' | 'completed';
			requestedBy: string;
			completedAt?: Date;
		}> = [];

		try {
			const exists = await filesystem.exists(todoFilePath);
			if (exists) {
				const content = await filesystem.readFile(todoFilePath);
				todos = parseTodoFromMarkdown(content);
			}
		} catch (error) {
			console.error('Error reading todos:', error);
		}

		switch (action) {
			case 'add': {
				if (!title || !description || !priority || !requestedBy) {
					return {
						success: false,
						message: 'Title, description, priority, and requestedBy are required for adding a todo'
					};
				}

				const newTodo = {
					id: crypto.randomUUID(),
					title,
					description,
					priority,
					status: 'pending' as const,
					requestedBy
				};

				todos.push(newTodo);

				// Save to file
				const content = todos.map((todo) => formatTodoAsMarkdown(todo)).join('\n');
				await filesystem.writeFile(todoFilePath, content);

				return {
					success: true,
					message: 'Todo added successfully',
					todo: newTodo
				};
			}

			case 'complete': {
				if (!todoId) {
					return {
						success: false,
						message: 'Todo ID is required for completing a todo'
					};
				}

				const todoIndex = todos.findIndex((t) => t.id === todoId);
				if (todoIndex === -1) {
					return {
						success: false,
						message: 'Todo not found'
					};
				}

				todos[todoIndex] = {
					...todos[todoIndex],
					status: 'completed',
					completedAt: new Date()
				};

				// Save to file
				const content = todos.map((todo) => formatTodoAsMarkdown(todo)).join('\n');
				await filesystem.writeFile(todoFilePath, content);

				return {
					success: true,
					message: 'Todo marked as completed',
					todo: todos[todoIndex]
				};
			}

			case 'list': {
				// Sort todos by priority and status
				const sortedTodos = [...todos].sort((a, b) => {
					// Sort by status (pending first)
					if (a.status === 'pending' && b.status !== 'pending') return -1;
					if (a.status !== 'pending' && b.status === 'pending') return 1;

					// Then sort by priority
					const priorityOrder = { high: 0, medium: 1, low: 2 };
					return priorityOrder[a.priority] - priorityOrder[b.priority];
				});

				return {
					success: true,
					message: 'Todos retrieved successfully',
					todos: sortedTodos
				};
			}

			case 'update_priority': {
				if (!todoId || !priority) {
					return {
						success: false,
						message: 'Todo ID and new priority are required for updating priority'
					};
				}

				const todoIndex = todos.findIndex((t) => t.id === todoId);
				if (todoIndex === -1) {
					return {
						success: false,
						message: 'Todo not found'
					};
				}

				todos[todoIndex] = {
					...todos[todoIndex],
					priority
				};

				// Save to file
				const content = todos.map((todo) => formatTodoAsMarkdown(todo)).join('\n');
				await filesystem.writeFile(todoFilePath, content);

				return {
					success: true,
					message: 'Todo priority updated',
					todo: todos[todoIndex]
				};
			}

			default:
				return {
					success: false,
					message: 'Invalid action'
				};
		}
	}) satisfies ToolExecuteFunction
);
