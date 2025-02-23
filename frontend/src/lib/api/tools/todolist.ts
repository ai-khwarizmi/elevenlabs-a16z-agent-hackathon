import { Tool, type ToolExecuteFunction } from '$lib/utils/tool.svelte';

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

		switch (action) {
			case 'add': {
				if (!title || !description || !priority || !requestedBy) {
					return {
						success: false,
						message: 'Title, description, priority, and requestedBy are required for adding a todo'
					};
				}

				const newTodo = agent.addTodo({
					title,
					description,
					priority: priority as 'high' | 'medium' | 'low',
					requestedBy
				});

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

				const completedTodo = agent.completeTodo(todoId);
				if (!completedTodo) {
					return {
						success: false,
						message: 'Todo not found'
					};
				}

				return {
					success: true,
					message: 'Todo marked as completed',
					todo: completedTodo
				};
			}

			case 'list': {
				const todos = agent.getTodos();
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

				const updatedTodo = agent.updateTodoPriority(todoId, priority as 'high' | 'medium' | 'low');
				if (!updatedTodo) {
					return {
						success: false,
						message: 'Todo not found'
					};
				}

				return {
					success: true,
					message: 'Todo priority updated',
					todo: updatedTodo
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
