import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'agent-profile-pictures';
const STORE_NAME = 'profile-pictures';
const DB_VERSION = 1;

export interface ProfilePictureEntry {
	prompt: string;
	blob: Blob;
	url: string;
	timestamp: number;
}

let db: IDBPDatabase | null = null;

async function getDB() {
	if (!db) {
		db = await openDB(DB_NAME, DB_VERSION, {
			upgrade(db: IDBPDatabase) {
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME, { keyPath: 'prompt' });
				}
			}
		});
	}
	return db;
}

export async function storeProfilePicture(prompt: string, imageUrl: string): Promise<string> {
	try {
		// Check if we already have an image for this prompt
		const db = await getDB();
		const existing = await db.get(STORE_NAME, prompt);
		if (existing) {
			// Create a new URL for the existing blob
			URL.revokeObjectURL(existing.url);
			const newUrl = URL.createObjectURL(existing.blob);

			// Update the URL in the database
			await db.put(STORE_NAME, {
				...existing,
				url: newUrl
			});

			return newUrl;
		}

		// If not found, download and store the new image
		const response = await fetch(imageUrl);
		const blob = await response.blob();

		// Create a local URL for the blob
		const localUrl = URL.createObjectURL(blob);

		// Store in IndexedDB
		await db.put(STORE_NAME, {
			prompt,
			blob,
			url: localUrl,
			timestamp: Date.now()
		});

		return localUrl;
	} catch (error) {
		console.error('Failed to store profile picture:', error);
		throw error;
	}
}

export async function getProfilePicture(prompt: string): Promise<string | null> {
	try {
		const db = await getDB();
		const entry = await db.get(STORE_NAME, prompt);

		if (entry) {
			// Create a new object URL each time to ensure it's fresh
			URL.revokeObjectURL(entry.url);
			const newUrl = URL.createObjectURL(entry.blob);

			// Update the URL in the database
			await db.put(STORE_NAME, {
				...entry,
				url: newUrl
			});

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
		const allEntries = await db.getAll(STORE_NAME);

		for (const entry of allEntries) {
			if (!activePrompts.includes(entry.prompt)) {
				URL.revokeObjectURL(entry.url);
				await db.delete(STORE_NAME, entry.prompt);
			}
		}
	} catch (error) {
		console.error('Failed to clean up unused profile pictures:', error);
	}
}
