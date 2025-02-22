import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'agent-voices';
const STORE_NAME = 'voice-ids';
const DB_VERSION = 1;

export interface VoiceEntry {
	id?: number; // Auto-incrementing key
	description: string;
	voiceId: string;
	timestamp: number;
}

let db: IDBPDatabase | null = null;

async function getDB() {
	if (!db) {
		try {
			db = await openDB(DB_NAME, DB_VERSION, {
				upgrade(db: IDBPDatabase) {
					if (!db.objectStoreNames.contains(STORE_NAME)) {
						const store = db.createObjectStore(STORE_NAME, {
							keyPath: 'id',
							autoIncrement: true
						});
						store.createIndex('description', 'description', { unique: false });
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
			await deleteDB();
			db = await openDB(DB_NAME, DB_VERSION, {
				upgrade(db: IDBPDatabase) {
					const store = db.createObjectStore(STORE_NAME, {
						keyPath: 'id',
						autoIncrement: true
					});
					store.createIndex('description', 'description', { unique: false });
				}
			});
		}
	}
	return db;
}

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

export async function storeVoiceId(description: string, voiceId: string): Promise<void> {
	try {
		if (!description || typeof description !== 'string') {
			throw new Error('Invalid description: description must be a non-empty string');
		}

		const db = await getDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const index = store.index('description');

		// Check if we already have a voice for this description
		const existing = await index.get(description);

		if (existing) {
			await store.put({
				...existing,
				voiceId,
				timestamp: Date.now()
			});
		} else {
			const entry: VoiceEntry = {
				description,
				voiceId,
				timestamp: Date.now()
			};
			await store.add(entry);
		}

		await tx.done;
	} catch (error) {
		console.error('Failed to store voice ID:', error);
		throw error;
	}
}

export async function getVoiceId(description: string): Promise<string | null> {
	try {
		if (!description || typeof description !== 'string') {
			return null;
		}

		const db = await getDB();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const index = store.index('description');
		const entry = await index.get(description);

		return entry ? entry.voiceId : null;
	} catch (error) {
		console.error('Failed to retrieve voice ID:', error);
		return null;
	}
}

export async function deleteUnusedVoices(activeDescriptions: string[]): Promise<void> {
	try {
		const db = await getDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);

		const allEntries = await store.getAll();

		for (const entry of allEntries) {
			if (!activeDescriptions.includes(entry.description)) {
				await store.delete(entry.id!);
			}
		}

		await tx.done;
	} catch (error) {
		console.error('Failed to clean up unused voices:', error);
	}
}
