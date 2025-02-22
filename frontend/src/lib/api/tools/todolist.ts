import { agents } from '$lib/stores/agents.svelte';
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
				agentId: {
					name: 'agentId',
					description: 'ID of the agent to manage todos for',
					type: 'string'
				},
				action: {
					name: 'action',
					description: 'Action to perform on todos',
					type: 'string',
					enum: ['add', 'complete', 'list', 'update_priority']
				},
				title: {
					name: 'title',
					description: 'Title of the todo item',
					type: 'string'
				},
				description: {
					name: 'description',
					description: 'Detailed description of the todo item',
					type: 'string'
				},
				priority: {
					name: 'priority',
					description: 'Priority level of the todo item',
					type: 'string',
					enum: ['high', 'medium', 'low']
				},
				todoId: {
					name: 'todoId',
					description: 'ID of the todo item to update',
					type: 'string'
				},
				requestedBy: {
					name: 'requestedBy',
					description: 'Name of the agent or user who requested this todo',
					type: 'string'
				}
			},
			required: ['action']
		}
	},
	(async (args) => {
		if (typeof args !== 'object' || args === null) {
			return {
				success: false,
				message: 'Invalid arguments'
			};
		}

		if (typeof args.agentId !== 'string') {
			return {
				success: false,
				message: 'Agent ID is required'
			};
		}

		const { agentId, action, title, description, priority, todoId, requestedBy } = args;

		if (typeof title !== 'string') {
			return {
				success: false,
				message: 'Title is required'
			};
		}

		if (typeof description !== 'string') {
			return {
				success: false,
				message: 'Description is required'
			};
		}

		if (typeof priority !== 'string') {
			return {
				success: false,
				message: 'Priority is required'
			};
		}

		if (typeof todoId !== 'string') {
			return {
				success: false,
				message: 'Todo ID is required'
			};
		}

		if (typeof requestedBy !== 'string') {
			return {
				success: false,
				message: 'Requested by is required'
			};
		}

		const agent = agents.getAgentById(agentId);
		if (!agent) {
			return {
				success: false,
				message: 'Agent is required'
			};
		}

		switch (action) {
			case 'add': {
				if (!title || !description || !priority) {
					return {
						success: false,
						message: 'Title, description, and priority are required for adding a todo'
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
