import { Agent } from '$lib/utils/agent.svelte';
import { uid } from 'uid';
import { createHelperAgent } from '$lib/api/agents/helper';
import type { TimestampedMessage } from '$lib/types/messages';
import { getGlobalChatlog } from './chatlog.svelte';

interface SerializedSession {
	id: string;
	name: string;
	createdAt: string;
	lastModified: string;
	agents: ReturnType<Agent['toJSON']>[];
}

interface Session {
	id: string;
	name: string;
	createdAt: string;
	lastModified: string;
	agents: Agent[];
}

const SESSION_LIST_KEY = 'session-list';
const LAST_SESSION_KEY = 'last-session-id';

function getSessionKey(id: string): string {
	return `session_${id}`;
}

/**
 * Global state for all sessions and agents - using Svelte's $state for reactivity
 */
let sessionList = $state<Session[]>([]);
let currentSessionId = $state<string | null>(null);
let saveTimeout: number | null = null;

// Debounced save function
function debouncedSave(session: Session) {
	if (saveTimeout) {
		clearTimeout(saveTimeout);
	}

	saveTimeout = setTimeout(() => {
		saveSession(session);
		saveTimeout = null;
	}, 1000) as unknown as number;
}

// Use derived state to watch for changes in the current session
const currentSession = $derived.by<Session | undefined>(() => {
	const session = currentSessionId ? sessionList.find((s) => s.id === currentSessionId) : undefined;
	if (session) {
		debouncedSave(session);
	}
	return session;
});

// Load sessions from localStorage on initialization
if (typeof window !== 'undefined') {
	const storedSessionIds = localStorage.getItem(SESSION_LIST_KEY);
	const sessionIds = storedSessionIds ? JSON.parse(storedSessionIds) : [];

	// Load session metadata for all sessions
	sessionList = [];
	for (const id of sessionIds) {
		const storedSession = localStorage.getItem(getSessionKey(id));
		if (storedSession) {
			try {
				const serializedSession: SerializedSession = JSON.parse(storedSession);
				// Only create the session object without deserializing agents yet
				sessionList.push({
					...serializedSession,
					agents: [] // We'll load agents only when needed
				});
			} catch (error) {
				console.warn(`Failed to parse session ${id}:`, error);
			}
		}
	}

	// Ensure there's always at least one session
	if (sessionList.length === 0) {
		const defaultSession: Session = {
			id: uid(),
			name: 'Default Session',
			createdAt: new Date().toISOString(),
			lastModified: new Date().toISOString(),
			agents: []
		};

		try {
			// Add helper agent to the default session
			defaultSession.agents.push(createHelperAgent());
		} catch (error) {
			console.warn('Failed to create helper agent:', error);
		}

		sessionList = [defaultSession];
		// Save the new session
		localStorage.setItem(SESSION_LIST_KEY, JSON.stringify([defaultSession.id]));
		saveSession(defaultSession);
	}

	// Try to load the last used session, fallback to first session if not found
	const lastSessionId = localStorage.getItem(LAST_SESSION_KEY);
	if (lastSessionId && sessionList.find((s) => s.id === lastSessionId)) {
		loadSessionAgents(lastSessionId);
		currentSessionId = lastSessionId;
	} else {
		loadSessionAgents(sessionList[0].id);
		currentSessionId = sessionList[0].id;
	}
}

// Helper function to save a single session to localStorage
function saveSession(session: Session) {
	if (typeof window !== 'undefined') {
		const serializedSession: SerializedSession = {
			...session,
			agents: session.agents.map((agent) => agent.toJSON())
		};
		localStorage.setItem(getSessionKey(session.id), JSON.stringify(serializedSession));
	}
}

// Helper function to load agents for a session
function loadSessionAgents(sessionId: string) {
	const session = sessionList.find((s) => s.id === sessionId);
	if (!session) return;

	// Always clear and reload agents when switching sessions
	const storedSession = localStorage.getItem(getSessionKey(sessionId));
	if (storedSession) {
		try {
			const serializedSession: SerializedSession = JSON.parse(storedSession);
			session.agents = serializedSession.agents.map((agent) => Agent.fromJSON(agent));
		} catch (error) {
			console.warn(`Failed to load agents for session ${sessionId}:`, error);
			session.agents = []; // Reset on error
		}
	} else {
		session.agents = []; // Reset if no stored data
	}
}

export const sessions = {
	get list() {
		return sessionList;
	},
	get current(): Session | undefined {
		return currentSession;
	},
	createSession(name: string): Session {
		const session: Session = {
			id: uid(),
			name,
			createdAt: new Date().toISOString(),
			lastModified: new Date().toISOString(),
			agents: []
		};

		try {
			// Add helper agent to new sessions by default
			session.agents.push(createHelperAgent());
		} catch (error) {
			console.warn('Failed to create helper agent:', error);
		}

		sessionList.push(session);
		currentSessionId = session.id;

		// Save session list and new session
		const sessionIds = sessionList.map((s) => s.id);
		localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionIds));
		localStorage.setItem(LAST_SESSION_KEY, session.id);
		saveSession(session);

		return session;
	},
	loadSession(id: string): void {
		const session = sessionList.find((s) => s.id === id);
		if (session) {
			loadSessionAgents(id);
			currentSessionId = session.id;
			localStorage.setItem(LAST_SESSION_KEY, session.id);
		}
	},
	deleteSession(id: string): void {
		// Don't allow deleting the last session
		if (sessionList.length <= 1) {
			return;
		}
		const index = sessionList.findIndex((s) => s.id === id);
		if (index !== -1) {
			// Remove from localStorage
			localStorage.removeItem(getSessionKey(id));

			// Update session list
			sessionList.splice(index, 1);
			const sessionIds = sessionList.map((s) => s.id);
			localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionIds));

			// Update current session if needed
			if (currentSessionId === id) {
				currentSessionId = sessionList[0].id;
				loadSessionAgents(currentSessionId);
				localStorage.setItem(LAST_SESSION_KEY, currentSessionId);
			}
		}
	},
	renameSession(id: string, newName: string): void {
		const session = sessionList.find((s) => s.id === id);
		if (session) {
			session.name = newName;
			session.lastModified = new Date().toISOString();
			saveSession(session);
		}
	}
};

export const agents = {
	get list() {
		return sessions.current?.agents ?? [];
	},
	set list(value: Agent[]) {
		if (sessions.current) {
			sessions.current.agents = value;
			sessions.current.lastModified = new Date().toISOString();
			saveSession(sessions.current);
		}
	},
	addAgent(agent: Agent): void {
		if (sessions.current) {
			sessions.current.agents.push(agent);
			sessions.current.lastModified = new Date().toISOString();
			saveSession(sessions.current);
		}
	},
	removeAgent(name: string): void {
		if (sessions.current) {
			const index = sessions.current.agents.findIndex((a) => a.getName() === name);
			if (index !== -1) {
				sessions.current.agents.splice(index, 1);
				sessions.current.lastModified = new Date().toISOString();
				saveSession(sessions.current);
			}
		}
	},
	getAgent(name: string): Agent | undefined {
		return sessions.current?.agents.find((a) => a.getName() === name);
	},
	getAgentById(id: string): Agent | undefined {
		return sessions.current?.agents.find((a) => a.id === id);
	},
	clearAgents(): void {
		if (sessions.current) {
			sessions.current.agents = [];
			sessions.current.lastModified = new Date().toISOString();
			saveSession(sessions.current);
		}
	},
	/**
	 * Get a global chatlog of all messages between agents and users, ordered by timestamp
	 * Excludes system messages and tool calls
	 * @returns Array of messages with timestamp
	 */
	getGlobalChatlog(): TimestampedMessage[] {
		if (!sessions.current) return [];
		return getGlobalChatlog(sessions.current.agents);
	}
};
