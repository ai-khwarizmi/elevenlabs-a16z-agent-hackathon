import { openDB, type IDBPDatabase, type IDBPObjectStore } from 'idb';

const DB_NAME = 'agent-profile-pictures';
const STORE_NAME = 'profile-pictures';
const DB_VERSION = 1;

export interface ProfilePictureEntry {
	id?: number; // Auto-incrementing key
	prompt: string;
	blob: Blob;
	url: string;
	timestamp: number;
}

let db: IDBPDatabase | null = null;

async function getDB() {
	if (!db) {
		try {
			// Try to open the database normally first
			db = await openDB(DB_NAME, DB_VERSION, {
				upgrade(db: IDBPDatabase) {
					// Create store if it doesn't exist
					if (!db.objectStoreNames.contains(STORE_NAME)) {
						const store = db.createObjectStore(STORE_NAME, {
							keyPath: 'id',
							autoIncrement: true
						});
						store.createIndex('prompt', 'prompt', { unique: false });
					}
				},
				blocked() {
					console.warn('Database upgrade blocked. Please close other tabs using this app.');
				},
				blocking() {
					if (db) {
						db.close();
						db = null;
					}
				},
				terminated() {
					db = null;
				}
			});
		} catch (error) {
			console.error('Failed to open database, recreating:', error);
			// Only delete and recreate if there was an error
			await deleteDB();
			db = await openDB(DB_NAME, DB_VERSION, {
				upgrade(db: IDBPDatabase) {
					const store = db.createObjectStore(STORE_NAME, {
						keyPath: 'id',
						autoIncrement: true
					});
					store.createIndex('prompt', 'prompt', { unique: false });
				}
			});
		}
	}
	return db;
}

// Helper function to delete the database if needed
async function deleteDB() {
	try {
		const databases = await window.indexedDB.databases();
		const exists = databases.some((db) => db.name === DB_NAME);
		if (exists) {
			await window.indexedDB.deleteDatabase(DB_NAME);
		}
	} catch (error) {
		console.error('Failed to delete database:', error);
	}
}

export async function storeProfilePicture(prompt: string, imageUrl: string): Promise<string> {
	try {
		if (!prompt || typeof prompt !== 'string') {
			throw new Error('Invalid prompt: prompt must be a non-empty string');
		}

		// Check if we already have an image for this prompt
		const db = await getDB();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const index = store.index('prompt');
		const existing = await index.get(prompt);

		if (existing) {
			// Create a new URL for the existing blob
			URL.revokeObjectURL(existing.url);
			const newUrl = URL.createObjectURL(existing.blob);

			// Update the URL in the database
			const updateTx = db.transaction(STORE_NAME, 'readwrite');
			const updateStore = updateTx.objectStore(STORE_NAME);
			await updateStore.put({
				...existing,
				url: newUrl
			});
			await updateTx.done;

			return newUrl;
		}

		// If not found, download and store the new image
		const response = await fetch(imageUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.statusText}`);
		}
		const blob = await response.blob();

		// Create a local URL for the blob
		const localUrl = URL.createObjectURL(blob);

		// Store in IndexedDB
		const storeTx = db.transaction(STORE_NAME, 'readwrite');
		const storeStore = storeTx.objectStore(STORE_NAME);
		const entry: ProfilePictureEntry = {
			prompt,
			blob,
			url: localUrl,
			timestamp: Date.now()
		};
		await storeStore.add(entry);
		await storeTx.done;

		return localUrl;
	} catch (error) {
		console.error('Failed to store profile picture:', error);
		throw error;
	}
}

export async function getProfilePicture(prompt: string): Promise<string | null> {
	try {
		if (!prompt || typeof prompt !== 'string') {
			return null;
		}

		const db = await getDB();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const index = store.index('prompt');
		const entry = await index.get(prompt);

		if (entry) {
			// Create a new object URL each time to ensure it's fresh
			URL.revokeObjectURL(entry.url);
			const newUrl = URL.createObjectURL(entry.blob);

			// Update the URL in the database
			const updateTx = db.transaction(STORE_NAME, 'readwrite');
			const updateStore = updateTx.objectStore(STORE_NAME);
			await updateStore.put({
				...entry,
				url: newUrl
			});
			await updateTx.done;

			return newUrl;
		}
		return null;
	} catch (error) {
		console.error('Failed to retrieve profile picture:', error);
		return null;
	}
}

export async function deleteUnusedProfilePictures(activePrompts: string[]): Promise<void> {
	try {
		const db = await getDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);

		const allEntries = await store.getAll();

		for (const entry of allEntries) {
			if (!activePrompts.includes(entry.prompt)) {
				URL.revokeObjectURL(entry.url);
				await store.delete(entry.id!);
			}
		}

		await tx.done;
	} catch (error) {
		console.error('Failed to clean up unused profile pictures:', error);
	}
}
