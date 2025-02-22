import { Tool, type ToolExecuteFunction } from '$lib/utils/tool.svelte';
import type { SearchResponse } from '$lib/types/search';

/**
 * Tool for performing web searches using Google Custom Search
 */
export const searchTool = new Tool(
	{
		name: 'search',
		description: 'Search the web using Google Custom Search',
		parameters: {
			type: 'object',
			properties: {
				query: {
					name: 'query',
					description: 'The search query to execute',
					type: 'string'
				}
			},
			required: ['query']
		}
	},
	(async (args) => {
		if (typeof args !== 'object' || args === null) {
			return {
				success: false,
				message: 'Invalid arguments'
			};
		}

		const { query } = args;

		if (typeof query !== 'string') {
			return {
				success: false,
				message: 'Query must be a string'
			};
		}

		try {
			const response = await fetch('/api/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ query })
			});

			const data = (await response.json()) as SearchResponse;

			if (!response.ok) {
				return {
					success: false,
					message: data.error || 'Search failed'
				};
			}

			return {
				success: true,
				message: 'Search completed successfully',
				results: data.results
			};
		} catch (error) {
			console.error('Search error:', error);
			return {
				success: false,
				message: 'Failed to execute search'
			};
		}
	}) satisfies ToolExecuteFunction
);
