const STORAGE_KEYS = {
	OPENAI: 'openai-key',
	ELEVENLABS: 'elevenlabs-key',
	FAL: 'fal-key'
} as const;

export function getStoredKeys() {
	if (typeof window === 'undefined') return { openaiKey: '', elevenLabsKey: '' };

	return {
		openaiKey: localStorage.getItem(STORAGE_KEYS.OPENAI) || '',
		elevenLabsKey: localStorage.getItem(STORAGE_KEYS.ELEVENLABS) || '',
		falKey: localStorage.getItem(STORAGE_KEYS.FAL) || ''
	};
}

export function storeOpenAIKey(key: string) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEYS.OPENAI, key);
}

export function storeElevenLabsKey(key: string) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEYS.ELEVENLABS, key);
}

export function storeFalKey(key: string) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEYS.FAL, key);
}
