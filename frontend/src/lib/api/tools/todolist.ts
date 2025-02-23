import { Tool, type ToolExecuteFunction } from '$lib/utils/tool.svelte';
import { filesystem } from '$lib/stores/filesystem.svelte';
import { normalizeAgentName } from '$lib/stores/chatlog.svelte';
import { showNotification } from '$lib/stores/notifications';

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
	const priorityText = {
		high: '[HIGH]',
		medium: '[MEDIUM]',
		low: '[LOW]'
	};

	const statusText = todo.status === 'completed' ? '[COMPLETED]' : '[PENDING]';

	// Safely format the completedAt date
	let completedAtText = '';
	if (todo.completedAt) {
		try {
			// Ensure we have a valid date object
			const date = new Date(todo.completedAt);
			if (!isNaN(date.getTime())) {
				completedAtText = `**Completed At:** ${date.toISOString()}`;
			}
		} catch (error) {
			console.error('[TodoList] Error formatting completedAt date:', error);
		}
	}

	return `## ${todo.title} ${priorityText[todo.priority]} ${statusText}

**ID:** ${todo.id}
**Requested By:** ${todo.requestedBy}
${completedAtText}

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
	console.log('[TodoList] Parsing markdown content:', markdown.slice(0, 100) + '...');
	const todos = [];
	const sections = markdown.split('---').filter((section) => section.trim());
	console.log('[TodoList] Found sections:', sections.length);

	for (const section of sections) {
		console.log('[TodoList] Processing section:', section.slice(0, 100) + '...');
		const titleMatch = section.match(/## (.*?) \[(HIGH|MEDIUM|LOW)\] \[(PENDING|COMPLETED)\]/);
		const idMatch = section.match(/\*\*ID:\*\* (.*)/);
		const requestedByMatch = section.match(/\*\*Requested By:\*\* (.*)/);
		const completedAtMatch = section.match(/\*\*Completed At:\*\* (.*)/);
		const descriptionMatch = section.match(/### Description\n([\s\S]*?)(?=\n\*\*|$)/);

		console.log('[TodoList] Matches:', {
			hasTitle: !!titleMatch,
			hasId: !!idMatch,
			hasRequestedBy: !!requestedByMatch,
			hasCompletedAt: !!completedAtMatch,
			hasDescription: !!descriptionMatch
		});

		if (titleMatch && idMatch && requestedByMatch) {
			const [, title, priority, status] = titleMatch;

			// Safely parse the completedAt date
			let completedAt: Date | undefined = undefined;
			if (completedAtMatch) {
				try {
					const date = new Date(completedAtMatch[1].trim());
					if (!isNaN(date.getTime())) {
						completedAt = date;
					} else {
						console.warn('[TodoList] Invalid completedAt date:', completedAtMatch[1]);
					}
				} catch (error) {
					console.error('[TodoList] Error parsing completedAt date:', error);
				}
			}

			const todo = {
				id: idMatch[1].trim(),
				title: title.trim(),
				description: descriptionMatch ? descriptionMatch[1].trim() : '',
				priority: priority.toLowerCase() as 'high' | 'medium' | 'low',
				status: status.toLowerCase() as 'pending' | 'completed',
				requestedBy: requestedByMatch[1].trim(),
				completedAt
			};
			console.log('[TodoList] Created todo item:', todo);
			todos.push(todo);
		} else {
			console.warn('[TodoList] Skipping invalid section - missing required fields');
		}
	}

	console.log('[TodoList] Parsed total todos:', todos.length);
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
		console.log('[TodoList] Tool called with args:', args);
		console.log('[TodoList] Agent:', agent.getName());

		if (typeof args !== 'object' || args === null) {
			console.error('[TodoList] Invalid arguments provided');
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
		console.log('[TodoList] Creating /todos directory if needed');
		await filesystem.mkdirp('/todos');

		// Get agent's todo file path
		const todoFilePath = `/todos/${normalizeAgentName(agent.getName())}.md`;
		console.log('[TodoList] Using todo file path:', todoFilePath);

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
			console.log('[TodoList] Checking if todo file exists');
			const exists = await filesystem.exists(todoFilePath);
			console.log('[TodoList] File exists:', exists);

			if (exists) {
				console.log('[TodoList] Reading todo file');
				const content = await filesystem.readFile(todoFilePath);
				console.log('[TodoList] File content length:', content.length);
				todos = parseTodoFromMarkdown(content);
			} else {
				console.log('[TodoList] No existing todo file found');
			}
		} catch (error) {
			console.error('[TodoList] Error reading todos:', error);
		}

		console.log('[TodoList] Loaded todos:', todos.length);

		switch (action) {
			case 'add': {
				console.log('[TodoList] Adding new todo');
				if (!title || !description || !priority || !requestedBy) {
					console.error('[TodoList] Missing required fields for add');
					return {
						success: false,
						message: 'Title, description, priority, and requestedBy are required for adding a todo'
					};
				}

				// Check for number of pending todos
				const pendingTodos = todos.filter((todo) => todo.status === 'pending');
				if (pendingTodos.length >= 5) {
					console.error('[TodoList] Too many pending todos');
					throw new Error(
						'Cannot add more todos. Please complete some existing todos first (maximum 5 pending todos allowed).'
					);
				}

				const newTodo = {
					id: crypto.randomUUID(),
					title,
					description,
					priority,
					status: 'pending' as const,
					requestedBy
				};
				console.log('[TodoList] Created new todo:', newTodo);

				todos.push(newTodo);

				// Save to file
				console.log('[TodoList] Saving updated todos to file');
				const content = todos.map((todo) => formatTodoAsMarkdown(todo)).join('\n');
				await filesystem.writeFile(todoFilePath, content);
				console.log('[TodoList] File saved successfully');

				// Show notification
				const priorityText = { high: '[HIGH]', medium: '[MEDIUM]', low: '[LOW]' };
				showNotification(
					`${agent.getName()} added new ${priority} priority task: ${title} ${priorityText[priority]}`,
					'info'
				);

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

				const oldPriority = todos[todoIndex].priority;
				todos[todoIndex] = {
					...todos[todoIndex],
					priority
				};

				// Save to file
				const content = todos.map((todo) => formatTodoAsMarkdown(todo)).join('\n');
				await filesystem.writeFile(todoFilePath, content);

				// Show notification for priority change
				const priorityText = { high: '[HIGH]', medium: '[MEDIUM]', low: '[LOW]' };
				showNotification(
					`${agent.getName()} changed task priority: "${todos[todoIndex].title}" ${priorityText[oldPriority]} → ${priorityText[priority]}`,
					'info'
				);

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
