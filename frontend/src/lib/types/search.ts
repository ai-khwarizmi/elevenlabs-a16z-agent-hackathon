export interface SearchResult {
	title: string;
	link: string;
	snippet: string;
	source: 'serper';
}

export interface SearchResponse {
	results: SearchResult[];
	error?: string;
}

export interface SerperSearchResult {
	title: string;
	link: string;
	snippet: string;
	position: number;
	[key: string]: unknown;
}

export interface GoogleSearchItem {
	title: string;
	link: string;
	snippet: string;
	[key: string]: any; // Additional fields we don't use
}
