<script lang="ts">
	import { filesystem } from '$lib/stores/filesystem.svelte';
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import TextScramble from './TextScramble.svelte';
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
	let isDragging = $state(false);
	let isResizing = $state(false);
	let width = $state(800);
	let height = $state(256); // 64 * 4 (original height)
	let position = $state({ x: 8, y: 0 }); // Will be set properly in onMount
	let defaultPosition = { x: 8, y: 0 }; // Will be set properly in onMount

	// Track filesystem changes
	let lastUpdate = $derived(filesystem.lastUpdate);

	// Resize state
	let resizeHandles = $state([
		{ id: 'e', cursor: 'e-resize', edge: 'right' },
		{ id: 'w', cursor: 'w-resize', edge: 'left' },
		{ id: 'n', cursor: 'n-resize', edge: 'top' },
		{ id: 's', cursor: 's-resize', edge: 'bottom' },
		{ id: 'ne', cursor: 'ne-resize', edge: 'ne' },
		{ id: 'nw', cursor: 'nw-resize', edge: 'nw' },
		{ id: 'se', cursor: 'se-resize', edge: 'se' },
		{ id: 'sw', cursor: 'sw-resize', edge: 'sw' }
	]);

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

						/* Scrollbar Styling */
						::-webkit-scrollbar {
							width: 8px;
							height: 8px;
						}

						::-webkit-scrollbar-track {
							background: #1a1a1a;
							border-radius: 4px;
						}

						::-webkit-scrollbar-thumb {
							background: #555555;
							border-radius: 4px;
							border: 2px solid #1a1a1a;
						}

						::-webkit-scrollbar-thumb:hover {
							background: #666666;
						}

						::-webkit-scrollbar-corner {
							background: #1a1a1a;
						}

						/* Firefox scrollbar styling */
						* {
							scrollbar-width: thin;
							scrollbar-color: #555555 #1a1a1a;
						}

						${
							isMarkdown
								? `
						/* Word-like document styles for markdown */
						.markdown-body {
							max-width: 7.5in;
							margin: 0 auto;
							padding: 0.25in 0.3in;
							background: #000000;
							color: #e0e0e0;
							font-family: 'Consolas', 'Monaco', 'Andale Mono', 'Ubuntu Mono', monospace;
							line-height: 1.5;
							font-size: 10.5pt;
							box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
						}
						
						/* Headings */
						h1, h2, h3, h4, h5, h6 {
							font-family: 'Consolas', 'Monaco', 'Andale Mono', 'Ubuntu Mono', monospace;
							color: #ffffff;
							margin-top: 1.2em;
							margin-bottom: 0.5em;
							font-weight: 600;
							line-height: 1.2;
						}
						
						h1 { font-size: 14pt; }
						h2 { font-size: 13pt; }
						h3 { font-size: 12pt; }
						h4, h5, h6 { font-size: 10.5pt; }
						
						/* Links */
						a {
							color: #e0e0e0;
							text-decoration: underline;
						}
						a:hover {
							color: #ffffff;
						}
						
						/* Code blocks */
						code {
							font-family: inherit;
							background: #111111;
							padding: 0.2em 0.4em;
							border-radius: 2px;
							font-size: 10pt;
							color: #e0e0e0;
						}
						
						pre {
							background: #111111;
							padding: 0.8em;
							border-radius: 2px;
							border: 1px solid #222;
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
							border-left: 3px solid #e0e0e0;
							margin: 1em 0;
							padding: 0.5em 1em;
							background: #111111;
							color: #bbb;
						}
						
						/* Tables */
						table {
							border-collapse: collapse;
							width: 100%;
							margin: 1em 0;
							font-size: 10pt;
						}
						
						th, td {
							border: 1px solid #222;
							padding: 6px 10px;
							text-align: left;
						}
						
						th {
							background: #111111;
							font-weight: 600;
							color: #ffffff;
						}
						
						tr:nth-child(even) {
							background: #111111;
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
							border-top: 1px solid #222;
							margin: 1.2em 0;
						}
						
						/* Images */
						img {
							max-width: 100%;
							height: auto;
							margin: 1em 0;
							opacity: 0.9;
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

	// Resize handling
	function startResize(event: MouseEvent, handle: { edge: string }) {
		event.preventDefault();
		isResizing = true;
		const startX = event.clientX;
		const startY = event.clientY;
		const startWidth = width;
		const startHeight = height;
		const startPosition = { ...position };

		function onMouseMove(e: MouseEvent) {
			const deltaX = e.clientX - startX;
			const deltaY = e.clientY - startY;

			switch (handle.edge) {
				case 'right':
					width = Math.max(400, startWidth + deltaX);
					break;
				case 'left':
					const newWidth = Math.max(400, startWidth - deltaX);
					width = newWidth;
					position.x = Math.max(0, startPosition.x - (newWidth - startWidth));
					break;
				case 'top':
					const newHeight = Math.max(200, startHeight - deltaY);
					height = newHeight;
					position.y = Math.max(0, startPosition.y - (newHeight - startHeight));
					break;
				case 'bottom':
					height = Math.max(200, startHeight + deltaY);
					break;
				case 'ne':
					width = Math.max(400, startWidth + deltaX);
					const neHeight = Math.max(200, startHeight - deltaY);
					height = neHeight;
					position.y = Math.max(0, startPosition.y - (neHeight - startHeight));
					break;
				case 'nw':
					const nwWidth = Math.max(400, startWidth - deltaX);
					width = nwWidth;
					position.x = Math.max(0, startPosition.x - (nwWidth - startWidth));
					const nwHeight = Math.max(200, startHeight - deltaY);
					height = nwHeight;
					position.y = Math.max(0, startPosition.y - (nwHeight - startHeight));
					break;
				case 'se':
					width = Math.max(400, startWidth + deltaX);
					height = Math.max(200, startHeight + deltaY);
					break;
				case 'sw':
					const swWidth = Math.max(400, startWidth - deltaX);
					width = swWidth;
					position.x = Math.max(0, startPosition.x - (swWidth - startWidth));
					height = Math.max(200, startHeight + deltaY);
					break;
			}
		}

		function onMouseUp() {
			isResizing = false;
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		}

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	}

	// Drag handling
	function startDrag(event: MouseEvent) {
		if (event.target instanceof Element && event.target.closest('button')) return;

		isDragging = true;
		const startX = event.clientX - position.x;
		const startY = event.clientY - position.y;

		function onMouseMove(e: MouseEvent) {
			position = {
				x: Math.max(0, Math.min(window.innerWidth - width, e.clientX - startX)),
				y: Math.max(0, Math.min(window.innerHeight - height, e.clientY - startY))
			};
		}

		function onMouseUp() {
			isDragging = false;
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		}

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	}

	// Update default position when window is resized
	function updateDefaultPosition() {
		if (typeof window !== 'undefined') {
			defaultPosition = { x: 8, y: window.innerHeight - height - 8 };
			if (!isExpanded) {
				position = defaultPosition;
			}
		}
	}

	// Handle window resize
	$effect(() => {
		window.addEventListener('resize', updateDefaultPosition);
		return () => window.removeEventListener('resize', updateDefaultPosition);
	});

	// Reset position when minimized
	$effect(() => {
		if (!isExpanded) {
			position = defaultPosition;
		}
	});

	// Initialize
	onMount(() => {
		// Set initial position at the bottom left
		position = { x: 8, y: window.innerHeight - height - 8 };
		defaultPosition = { x: 8, y: window.innerHeight - height - 8 };

		// Add window resize listener
		window.addEventListener('resize', updateDefaultPosition);

		// Initialize filesystem if needed
		if (filesystem.initialized) {
			checkHasFiles('/').then((result) => {
				hasFiles = result;
				if (result) {
					loadFiles('/');
				}
			});
		}

		// Cleanup
		return () => {
			window.removeEventListener('resize', updateDefaultPosition);
		};
	});
</script>

<svelte:window />

{#if hasFiles}
	<div
		class="fixed z-50 flex border border-white text-white transition-transform duration-300"
		class:translate-y-0={isExpanded}
		class:translate-y-68={!isExpanded}
		style="
			width: {width}px; 
			height: {height}px; 
			left: {position.x}px; 
			top: {position.y}px;
			{isDragging || isResizing ? 'user-select: none;' : ''}
		"
	>
		<!-- Resize handles -->
		{#each resizeHandles as handle (handle.id)}
			<div
				class="absolute opacity-0 transition-opacity hover:bg-[#FF6222] hover:opacity-100"
				style="
					{handle.edge.includes('w') ? 'left: -4px;' : ''}
					{handle.edge.includes('e') ? 'right: -4px;' : ''}
					{handle.edge.includes('n') ? 'top: -4px;' : ''}
					{handle.edge.includes('s') ? 'bottom: -4px;' : ''}
					{handle.edge.length === 2 ? 'width: 12px; height: 12px;' : 'width: 8px; height: 100%;'}
					{handle.edge.length === 1 ? 'width: 100%; height: 8px;' : ''}
					cursor: {handle.cursor};
				"
				onmousedown={(e) => startResize(e, handle)}
			/>
		{/each}

		{#if !isExpanded}
			<div class="absolute -top-20 left-4">
				<AppButton text="Show Files" variant="secondary" onClick={() => (isExpanded = true)} />
			</div>
		{/if}
		<div class="flex h-full w-full flex-col bg-black shadow-lg">
			<!-- Header -->
			<div
				class="flex cursor-move items-center justify-between border-b border-white bg-black p-2"
				onmousedown={startDrag}
			>
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
					<span class="text-sm font-medium">
						<TextScramble text={currentPath || '/'} duration={400} />
					</span>
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
			<div class="flex h-full overflow-hidden">
				<!-- File Tree -->
				<div class="flex w-1/3 flex-col overflow-hidden border-r border-white">
					{#if isLoading}
						<div class="flex items-center justify-center p-4">
							<div
								class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-white"
							></div>
						</div>
					{:else}
						<div class="h-full overflow-y-auto p-2">
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
											<TextScramble text={file} duration={400} />
											{#if isDirectory}
												<span class="ml-1 text-xs text-white">/</span>
											{/if}
										</span>
									</button>
								{/each}
							</div>
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
							<TextScramble text="Select a file to preview" duration={400} />
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Prevent text selection while resizing */
	:global(body.resizing) {
		user-select: none;
	}

	/* Custom Scrollbar Styling */
	:global(*::-webkit-scrollbar) {
		width: 8px;
		height: 8px;
	}

	:global(*::-webkit-scrollbar-track) {
		background: #1a1a1a;
		border-radius: 4px;
	}

	:global(*::-webkit-scrollbar-thumb) {
		background: #555555;
		border-radius: 4px;
		border: 2px solid #1a1a1a;
	}

	:global(*::-webkit-scrollbar-thumb:hover) {
		background: #666666;
	}

	:global(*::-webkit-scrollbar-corner) {
		background: #1a1a1a;
	}

	/* Firefox scrollbar styling */
	:global(*) {
		scrollbar-width: thin;
		scrollbar-color: #555555 #1a1a1a;
	}
</style>
