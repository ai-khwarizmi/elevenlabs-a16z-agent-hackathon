<script lang="ts">
	import { filesystem } from '$lib/stores/filesystem.svelte';
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import AppButton from './AppButton.svelte';

	// State
	let isExpanded = $state(true);
	let currentPath = $state('/');
	let files = $state<string[]>([]);
	let selectedFile = $state<string | null>(null);
	let fileContent = $state<string | null>(null);
	let isLoading = $state(false);
	let hasFiles = $state(false);
	let fileStats = $state<Record<string, boolean>>({});

	// Track filesystem changes
	let lastUpdate = $derived(filesystem.lastUpdate);

	// Helper function to check if a file is markdown
	function isMarkdownFile(filename: string): boolean {
		return /\.(md|markdown)$/i.test(filename);
	}

	// Helper function to join paths properly
	function joinPaths(base: string, path: string): string {
		// Remove any leading or trailing slashes from the path
		const cleanPath = path.replace(/^\/+|\/+$/g, '');
		// If base is root, just prepend a single slash
		if (base === '/') {
			return `/${cleanPath}`;
		}
		// Otherwise join with a single slash
		const cleanBase = base.replace(/\/+$/g, '');
		return `${cleanBase}/${cleanPath}`;
	}

	// Check if directory has any files (recursive)
	async function checkHasFiles(path: string): Promise<boolean> {
		try {
			const items = await filesystem.readdir(path);
			if (items.length > 0) {
				for (const item of items) {
					const fullPath = joinPaths(path, item);
					const stats = await filesystem.stat(fullPath);
					if (stats.isFile()) {
						return true;
					}
					if (stats.isDirectory()) {
						const hasSubFiles = await checkHasFiles(fullPath);
						if (hasSubFiles) return true;
					}
				}
			}
			return false;
		} catch (error) {
			console.error('Failed to check for files:', error);
			return false;
		}
	}

	// Load files in current directory and get their stats
	async function loadFiles(path: string) {
		try {
			isLoading = true;
			files = await filesystem.readdir(path);
			currentPath = path;

			// Clear file preview when changing directories
			selectedFile = null;
			fileContent = null;

			// Get stats for all files
			const stats: Record<string, boolean> = {};
			for (const file of files) {
				const fullPath = joinPaths(path, file);
				const fileStats = await filesystem.stat(fullPath);
				stats[file] = fileStats.isDirectory();
			}
			fileStats = stats;
		} catch (error) {
			console.error('Failed to load files:', error);
			files = [];
			fileStats = {};
		} finally {
			isLoading = false;
		}
	}

	// Reload current directory when filesystem changes
	$effect(() => {
		if (lastUpdate && filesystem.initialized) {
			checkHasFiles('/').then((result) => {
				hasFiles = result;
				if (result) {
					loadFiles(currentPath);
					// If a file is selected, reload its content
					if (selectedFile) {
						loadFileContent(selectedFile);
					}
				}
			});
		}
	});

	// Load file content
	async function loadFileContent(path: string) {
		try {
			isLoading = true;
			const stats = await filesystem.stat(path);
			if (stats.isFile()) {
				const content = await filesystem.readFile(path);
				const isMarkdown = isMarkdownFile(path);

				// Base styles for both markdown and regular content
				const baseStyles = `
					<style>
						body {
							color: white;
							background: black;
							font-family: system-ui, -apple-system, sans-serif;
							margin: 1rem;
						}
						${
							isMarkdown
								? `
						/* Word-like document styles for markdown */
						.markdown-body {
							max-width: 7in;
							margin: 0 auto;
							padding: 0.75in 0.6in;
							background: white;
							color: #222;
							font-family: 'Calibri', system-ui, -apple-system, sans-serif;
							line-height: 1.5;
							font-size: 11pt;
							box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
						}
						
						/* Headings */
						h1, h2, h3, h4, h5, h6 {
							font-family: 'Calibri', system-ui, -apple-system, sans-serif;
							color: #222;
							margin-top: 1.2em;
							margin-bottom: 0.5em;
							font-weight: 600;
							line-height: 1.2;
						}
						
						h1 { font-size: 16pt; }
						h2 { font-size: 14pt; }
						h3 { font-size: 12pt; }
						h4, h5, h6 { font-size: 11pt; }
						
						/* Links */
						a {
							color: #222;
							text-decoration: underline;
						}
						a:hover {
							color: #666;
						}
						
						/* Code blocks */
						code {
							font-family: 'Consolas', monospace;
							background: #f5f5f5;
							padding: 0.2em 0.4em;
							border-radius: 2px;
							font-size: 10pt;
							color: #222;
						}
						
						pre {
							background: #f5f5f5;
							padding: 0.8em;
							border-radius: 2px;
							border: 1px solid #e0e0e0;
							overflow-x: auto;
							margin: 1em 0;
						}
						
						pre code {
							background: none;
							padding: 0;
							border: none;
						}
						
						/* Blockquotes */
						blockquote {
							border-left: 3px solid #222;
							margin: 1em 0;
							padding: 0.5em 1em;
							background: #f5f5f5;
							color: #444;
						}
						
						/* Tables */
						table {
							border-collapse: collapse;
							width: 100%;
							margin: 1em 0;
							font-size: 10pt;
						}
						
						th, td {
							border: 1px solid #e0e0e0;
							padding: 6px 10px;
							text-align: left;
						}
						
						th {
							background: #f5f5f5;
							font-weight: 600;
							color: #222;
						}
						
						tr:nth-child(even) {
							background: #fafafa;
						}
						
						/* Lists */
						ul, ol {
							padding-left: 1.5em;
							margin: 0.5em 0;
						}
						
						li {
							margin: 0.25em 0;
						}
						
						/* Horizontal rule */
						hr {
							border: none;
							border-top: 1px solid #e0e0e0;
							margin: 1.2em 0;
						}
						
						/* Images */
						img {
							max-width: 100%;
							height: auto;
							margin: 1em 0;
						}
						
						/* Paragraphs */
						p {
							margin: 0.75em 0;
						}
						`
								: ''
						}
					</style>`;

				// Wrap the content with HTML that includes dark theme styling
				fileContent = isMarkdown
					? `${baseStyles}<div class="markdown-body">${marked(content, { breaks: true })}</div>`
					: `${baseStyles}${content}`;
				selectedFile = path;
			} else {
				await loadFiles(path);
			}
		} catch (error) {
			console.error('Failed to load file content:', error);
			fileContent = null;
		} finally {
			isLoading = false;
		}
	}

	// Navigate up one directory
	function navigateUp() {
		const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
		loadFiles(parentPath);
	}

	// Initialize
	onMount(() => {
		if (filesystem.initialized) {
			checkHasFiles('/').then((result) => {
				hasFiles = result;
				if (result) {
					loadFiles('/');
				}
			});
		}
	});
</script>

{#if hasFiles}
	<div
		class="fixed bottom-2 left-2 z-50 flex h-64 border border-white text-white transition-transform duration-300"
		class:translate-y-0={isExpanded}
		class:translate-y-68={!isExpanded}
	>
		{#if !isExpanded}
			<div
				class="absolute -top-20 left-4"
			>
				<AppButton text="Show Files" variant="secondary" onClick={() => (isExpanded = true)} />
			</div>
		{/if}
		<div class="flex h-full w-[800px] flex-col bg-black shadow-lg">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-white bg-black p-2">
				<div class="flex items-center gap-2">
					<button
						class="rounded p-1 hover:bg-gray-800"
						onclick={navigateUp}
						disabled={currentPath === '/'}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>
					<span class="text-sm font-medium">{currentPath || '/'}</span>
				</div>
				<button
					class="rounded p-1 hover:bg-gray-800"
					onclick={() => (isExpanded = !isExpanded)}
					aria-label={isExpanded ? 'Hide explorer' : 'Show explorer'}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 transition-transform duration-300"
						class:rotate-180={!isExpanded}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex h-full">
				<!-- File Tree -->
				<div class="w-1/3 overflow-y-auto border-r border-white p-2">
					{#if isLoading}
						<div class="flex items-center justify-center p-4">
							<div
								class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-white"
							></div>
						</div>
					{:else}
						<div class="space-y-1">
							{#each files as file}
								{@const isDirectory = fileStats[file]}
								<button
									class="group flex w-full items-center gap-2 rounded p-1 text-left text-sm hover:bg-gray-800"
									class:bg-gray-800={selectedFile === joinPaths(currentPath, file)}
									onclick={() => loadFileContent(joinPaths(currentPath, file))}
								>
									<div class="relative flex items-center">
										{#if isDirectory}
											<!-- Folder Arrow -->
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="absolute -left-1 h-3 w-3 text-white opacity-0 transition-opacity group-hover:opacity-100"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M9 5l7 7-7 7"
												/>
											</svg>
											<!-- Folder Icon -->
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-5 w-5"
												fill="#FFA500"
												viewBox="0 0 24 24"
												stroke="#D97706"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="1.5"
													d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
												/>
											</svg>
										{:else if isMarkdownFile(file)}
											<!-- Markdown Icon -->
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-5 w-5"
												viewBox="0 0 24 24"
												fill="none"
												stroke="#FF6222"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path d="M14 3v4a1 1 0 001 1h4" />
												<path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
												<path d="M9 13h6" />
												<path d="M9 17h3" />
											</svg>
										{:else}
											<!-- Regular File Icon -->
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-5 w-5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="1.5"
													d="M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
												/>
											</svg>
										{/if}
									</div>
									<span class="relative pl-1">
										{file}
										{#if isDirectory}
											<span class="ml-1 text-xs text-white">/</span>
										{/if}
									</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Preview -->
				<div class="flex-1 overflow-hidden p-2">
					{#if selectedFile && fileContent !== null}
						<iframe
							title="File Preview"
							class="h-full w-full rounded border border-white text-white"
							srcdoc={fileContent}
						/>
					{:else}
						<div class="flex h-full items-center justify-center text-white">
							Select a file to preview
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
