import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST endpoint to download files from external URLs
 * This endpoint acts as a proxy to avoid CORS issues when downloading files from external sources
 *
 * Request body should be JSON with format: { url: string }
 *
 * Returns:
 * - The file content as a base64 encoded string
 * - Content-Type header matching the original file
 * - x-filename header with the detected or fallback filename
 * - x-is-binary header indicating if the content is binary
 *
 * Error Responses:
 * - 400: Missing or invalid URL
 * - 404: File not found at URL
 * - 500: Server error during download
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const url = body?.url;

		if (!url || typeof url !== 'string') {
			error(400, 'Valid URL is required');
		}

		// Validate URL format
		try {
			new URL(url);
		} catch {
			error(400, 'Invalid URL format');
		}

		const response = await fetch(url);

		if (!response.ok) {
			error(response.status, `Failed to download file: ${response.statusText}`);
		}

		// Extract filename from various sources
		const contentType = response.headers.get('content-type') || 'application/octet-stream';
		const contentDisposition = response.headers.get('content-disposition');
		let filename = 'downloaded_file';

		if (contentDisposition) {
			// Try to get filename from content-disposition header
			const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
			if (matches && matches[1]) {
				filename = matches[1].replace(/['"]/g, '');
			}
		} else {
			// Fallback to URL path for filename
			try {
				const urlPath = new URL(url).pathname;
				const urlFilename = urlPath.split('/').pop();
				if (urlFilename && urlFilename.includes('.')) {
					filename = decodeURIComponent(urlFilename);
				}
			} catch {
				// Keep default filename if URL parsing fails
			}
		}

		// Determine if content should be treated as text or binary
		const isText = contentType.startsWith('text/') || contentType.includes('json');
		let content: string;

		if (isText) {
			// For text files, just get the text
			content = await response.text();
		} else {
			// For binary files, convert to base64
			const arrayBuffer = await response.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);
			const chunks: string[] = [];

			// Convert binary data to base64 in chunks to avoid call stack limits
			for (let i = 0; i < uint8Array.length; i += 1024) {
				const chunk = uint8Array.slice(i, i + 1024);
				chunks.push(String.fromCharCode(...chunk));
			}

			content = btoa(chunks.join(''));
		}

		return new Response(content, {
			headers: {
				'Content-Type': 'text/plain', // Always return as text
				'x-filename': filename,
				'x-is-binary': (!isText).toString(),
				'Cache-Control': 'no-cache'
			}
		});
	} catch (err) {
		console.error('Download error:', err);
		if (err instanceof Error) {
			error(500, err.message);
		} else {
			error(500, 'Failed to download file');
		}
	}
};
