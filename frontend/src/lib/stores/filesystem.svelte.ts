import type { FSModule, Stats, BrowserFS as BrowserFSType } from 'browserfs';
import { sessions } from './agents.svelte';

let fs = $state<FSModule | null>(null);
let initialized = $state(false);
let error = $state<Error | null>(null);
let currentSessionId = $state<string | null>(null);
let lastUpdate = $state(Date.now());

// Extend Window interface to include BrowserFS
declare global {
	interface Window {
		BrowserFS?: BrowserFSType;
	}
}

// Function to trigger an update
function triggerUpdate() {
	lastUpdate = Date.now();
}

/**
 * Ensure BrowserFS is initialized
 */
async function ensureBrowserFS(): Promise<BrowserFSType> {
	if (typeof window === 'undefined') {
		throw new Error('BrowserFS can only be initialized in browser environment');
	}

	// Wait for BrowserFS to be loaded
	return new Promise((resolve, reject) => {
		// If BrowserFS is already loaded, return it
		if (window.BrowserFS) {
			resolve(window.BrowserFS);
			return;
		}

		// Load BrowserFS script
		const script = document.createElement('script');
		script.src = 'https://unpkg.com/browserfs@1.4.3/dist/browserfs.min.js';
		script.onload = () => {
			if (window.BrowserFS) {
				resolve(window.BrowserFS);
			} else {
				reject(new Error('BrowserFS failed to load'));
			}
		};
		script.onerror = () => {
			reject(new Error('Failed to load BrowserFS script'));
		};
		document.head.appendChild(script);
	});
}

/**
 * Initialize the file system for a specific session
 */
async function init(sessionId?: string) {
	try {
		const BrowserFS = await ensureBrowserFS();

		// If no sessionId provided, use current session
		const targetSessionId = sessionId || sessions.current?.id;

		if (!targetSessionId) {
			throw new Error('No session ID available');
		}

		// If already initialized for this session, return
		if (initialized && currentSessionId === targetSessionId) {
			return;
		}

		await new Promise((resolve, reject) => {
			BrowserFS.configure(
				{
					fs: 'IndexedDB',
					options: {
						storeName: `agent_fs_${targetSessionId}` // Session-specific store
					}
				},
				(e?: Error) => {
					if (e) {
						error = e;
						reject(e);
						return;
					}
					fs = BrowserFS.BFSRequire('fs');
					initialized = true;
					currentSessionId = targetSessionId;
					resolve(undefined);
				}
			);
		});
	} catch (e) {
		error = e instanceof Error ? e : new Error(String(e));
		throw e;
	}
}

/**
 * Switch to a different session's filesystem
 */
async function switchSession(sessionId: string) {
	if (currentSessionId !== sessionId) {
		initialized = false;
		fs = null;
		await init(sessionId);
	}
}

/**
 * Create directory and its parents recursively
 */
async function mkdirp(path: string): Promise<void> {
	if (!fs || !initialized) await init();

	const parts = path.split('/').filter(Boolean);
	let currentPath = '';

	for (const part of parts) {
		currentPath += '/' + part;
		try {
			const exists = await new Promise<boolean>((resolve) => {
				fs!.exists(currentPath, resolve);
			});
			if (!exists) {
				await new Promise<void>((resolve, reject) => {
					fs!.mkdir(currentPath, (err?: Error) => {
						if (err) reject(err);
						else {
							triggerUpdate();
							resolve();
						}
					});
				});
			}
		} catch (error) {
			console.error(`Failed to create directory ${currentPath}:`, error);
			throw error;
		}
	}
}

/**
 * Write a file to the virtual file system
 */
async function writeFile(path: string, content: string | Buffer): Promise<void> {
	if (!fs || !initialized) await init();

	// Create parent directory if it doesn't exist
	const parentDir = path.split('/').slice(0, -1).join('/') || '/';
	if (parentDir !== '/') {
		await mkdirp(parentDir);
	}

	return new Promise((resolve, reject) => {
		fs!.writeFile(path, content, (err?: Error) => {
			if (err) reject(err);
			else {
				triggerUpdate();
				resolve();
			}
		});
	});
}

/**
 * Read a file from the virtual file system
 */
async function readFile(path: string): Promise<string> {
	if (!fs || !initialized) await init();
	return new Promise((resolve, reject) => {
		fs!.readFile(path, 'utf8', (err?: Error, data?: string) => {
			if (err) reject(err);
			else if (data === undefined) reject(new Error('No data returned'));
			else resolve(data);
		});
	});
}

/**
 * List files in a directory
 */
async function readdir(path: string): Promise<string[]> {
	if (!fs || !initialized) await init();
	return new Promise((resolve, reject) => {
		fs!.readdir(path, (err?: Error, files?: string[]) => {
			if (err) reject(err);
			else if (!files) reject(new Error('No files returned'));
			else resolve(files);
		});
	});
}

/**
 * Get file stats
 */
async function stat(path: string): Promise<Stats> {
	if (!fs || !initialized) await init();
	return new Promise((resolve, reject) => {
		fs!.stat(path, (err?: Error, stats?: Stats) => {
			if (err) reject(err);
			else if (!stats) reject(new Error('No stats returned'));
			else resolve(stats);
		});
	});
}

/**
 * Create a directory
 */
async function mkdir(path: string): Promise<void> {
	if (!fs || !initialized) await init();
	return new Promise((resolve, reject) => {
		fs!.mkdir(path, (err?: Error) => {
			if (err) reject(err);
			else {
				triggerUpdate();
				resolve();
			}
		});
	});
}

/**
 * Delete a file or directory
 */
async function unlink(path: string): Promise<void> {
	if (!fs || !initialized) await init();
	return new Promise((resolve, reject) => {
		fs!.unlink(path, (err?: Error) => {
			if (err) reject(err);
			else {
				triggerUpdate();
				resolve();
			}
		});
	});
}

/**
 * Check if a path exists
 */
async function exists(path: string): Promise<boolean> {
	if (!fs || !initialized) await init();
	return new Promise((resolve) => {
		fs!.exists(path, (exists: boolean) => {
			resolve(exists);
		});
	});
}

export const filesystem = {
	init,
	writeFile,
	readFile,
	readdir,
	stat,
	mkdir,
	mkdirp,
	unlink,
	exists,
	switchSession,
	get error() {
		return error;
	},
	get initialized() {
		return initialized;
	},
	get currentSessionId() {
		return currentSessionId;
	},
	get lastUpdate() {
		return lastUpdate;
	}
};
