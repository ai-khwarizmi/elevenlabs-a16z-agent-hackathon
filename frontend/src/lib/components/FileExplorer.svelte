<script lang="ts">
	import { filesystem } from '$lib/stores/filesystem.svelte';
	import { onMount } from 'svelte';

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
				fileContent = await filesystem.readFile(path);
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
		class="fixed bottom-0 left-0 z-50 flex h-64 transition-transform duration-300"
		class:translate-y-0={isExpanded}
		class:translate-y-64={!isExpanded}
	>
		<div class="flex h-full w-[800px] flex-col rounded-tr-lg bg-white shadow-lg">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-2">
				<div class="flex items-center gap-2">
					<button
						class="rounded p-1 hover:bg-gray-200"
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
					class="rounded p-1 hover:bg-gray-200"
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
				<div class="w-1/3 overflow-y-auto border-r border-gray-200 p-2">
					{#if isLoading}
						<div class="flex items-center justify-center p-4">
							<div
								class="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
							/>
						</div>
					{:else}
						<div class="space-y-1">
							{#each files as file}
								{@const isDirectory = fileStats[file]}
								<button
									class="group flex w-full items-center gap-2 rounded p-1 text-left text-sm hover:bg-gray-100"
									class:bg-blue-50={selectedFile === joinPaths(currentPath, file)}
									onclick={() => loadFileContent(joinPaths(currentPath, file))}
								>
									<div class="relative flex items-center">
										{#if isDirectory}
											<!-- Folder Arrow -->
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="absolute -left-1 h-3 w-3 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
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
										{:else}
											<!-- File Icon -->
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
											<span class="ml-1 text-xs text-gray-400">/</span>
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
							class="h-full w-full rounded border border-gray-200"
							srcdoc={fileContent}
						/>
					{:else}
						<div class="flex h-full items-center justify-center text-gray-500">
							Select a file to preview
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
