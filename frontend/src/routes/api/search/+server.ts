import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SerperSearchResult, SearchResult } from '$lib/types/search';
import { SERPER_API_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { query } = await request.json();

		if (!query) {
			return json({ error: 'Query is required' }, { status: 400 });
		}

		if (!SERPER_API_KEY) {
			return json({ error: 'Search API key not configured' }, { status: 500 });
		}

		const response = await fetch('https://google.serper.dev/search', {
			method: 'POST',
			headers: {
				'X-API-KEY': SERPER_API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ q: query })
		});

		const data = await response.json();

		if (!response.ok) {
			return json({ error: data.error || 'Search failed' }, { status: response.status });
		}

		// Transform the response to our standard format
		const results: SearchResult[] = (data.organic as SerperSearchResult[]).map((item) => ({
			title: item.title,
			link: item.link,
			snippet: item.snippet,
			source: 'serper'
		}));

		return json({ results });
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
