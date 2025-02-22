import { filesystem } from '$lib/stores/filesystem.svelte';
import { Tool, type ToolExecuteFunction } from '$lib/utils/tool.svelte';

/**
 * Tool for interacting with the virtual filesystem
 */
export const filesystemTool = new Tool(
	{
		name: 'filesystem',
		description: `Interact with files in a virtual filesystem. This tool allows you to:
- Read and write files
- List directory contents
- Check if files exist
- Create and delete directories
- Get file information
- You do not need to create the directory, it will be created if it does not exist.
All files are session-specific and persist between conversations within the same session.`,
		parameters: {
			type: 'object',
			properties: {
				command: {
					name: 'command',
					description: 'The operation to perform',
					type: 'string',
					enum: ['read', 'write', 'list', 'exists', 'delete', 'stat']
				},
				path: {
					name: 'path',
					description:
						'The file or directory path to operate on (e.g., "/notes/todo.txt" or "/projects")',
					type: 'string'
				},
				content: {
					name: 'content',
					description: 'For write operations, the content to write to the file',
					type: 'string'
				}
			},
			required: ['command', 'path']
		}
	},
	(async (args) => {
		if (typeof args !== 'object' || args === null) {
			return {
				success: false,
				message: 'Invalid arguments'
			};
		}

		const { command, path } = args;

		if (typeof command !== 'string' || typeof path !== 'string') {
			return {
				success: false,
				message: 'Command and path must be strings'
			};
		}

		try {
			switch (command) {
				case 'read': {
					const content = await filesystem.readFile(path);
					return {
						success: true,
						content
					};
				}

				case 'write': {
					const { content } = args;
					if (typeof content !== 'string') {
						return {
							success: false,
							message: 'Content must be a string'
						};
					}
					await filesystem.writeFile(path, content);
					return {
						success: true,
						message: `Successfully wrote to ${path}`
					};
				}

				case 'list': {
					const files = await filesystem.readdir(path);
					return {
						success: true,
						files,
						message: files.length
							? `Found ${files.length} items in ${path}`
							: `Directory ${path} is empty`
					};
				}

				case 'exists': {
					const exists = await filesystem.exists(path);
					return {
						success: true,
						exists,
						message: exists ? `${path} exists` : `${path} does not exist`
					};
				}

				case 'delete': {
					await filesystem.unlink(path);
					return {
						success: true,
						message: `Successfully deleted ${path}`
					};
				}

				case 'mkdir': {
					await filesystem.mkdir(path);
					return {
						success: true,
						message: `Successfully created directory ${path}`
					};
				}

				case 'stat': {
					const stats = await filesystem.stat(path);
					return {
						success: true,
						stats: {
							isFile: stats.isFile(),
							isDirectory: stats.isDirectory(),
							size: stats.size,
							modified: stats.mtime,
							created: stats.birthtime
						},
						message: `Got stats for ${path}`
					};
				}

				default:
					return {
						success: false,
						message: `Unknown command: ${command}`
					};
			}
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}) satisfies ToolExecuteFunction
);
