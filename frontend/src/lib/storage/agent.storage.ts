import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'agent-ids';
const STORE_NAME = 'agent-ids';
const DB_VERSION = 1;

export interface AgentEntry {
	id?: number; // Auto-incrementing key
	voiceId: string;
	agentId: string;
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
						store.createIndex('voiceId', 'voiceId', { unique: false });
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
					store.createIndex('voiceId', 'voiceId', { unique: false });
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

export async function storeAgentId(voiceId: string, agentId: string): Promise<void> {
	try {
		if (!voiceId || typeof voiceId !== 'string') {
			throw new Error('Invalid voiceId: voiceId must be a non-empty string');
		}

		const db = await getDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const index = store.index('voiceId');

		// Check if we already have an agent for this voiceId
		const existing = await index.get(voiceId);

		if (existing) {
			await store.put({
				...existing,
				agentId,
				timestamp: Date.now()
			});
		} else {
			const entry: AgentEntry = {
				voiceId,
				agentId,
				timestamp: Date.now()
			};
			await store.add(entry);
		}

		await tx.done;
	} catch (error) {
		console.error('Failed to store agent ID:', error);
		throw error;
	}
}

export async function getAgentId(voiceId: string): Promise<string | null> {
	try {
		if (!voiceId || typeof voiceId !== 'string') {
			return null;
		}

		const db = await getDB();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const index = store.index('voiceId');
		const entry = await index.get(voiceId);

		return entry ? entry.agentId : null;
	} catch (error) {
		console.error('Failed to retrieve agent ID:', error);
		return null;
	}
}

export async function deleteUnusedAgents(activeVoiceIds: string[]): Promise<void> {
	try {
		const db = await getDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);

		const allEntries = await store.getAll();

		for (const entry of allEntries) {
			if (!activeVoiceIds.includes(entry.voiceId)) {
				await store.delete(entry.id!);
			}
		}

		await tx.done;
	} catch (error) {
		console.error('Failed to clean up unused agents:', error);
	}
}
