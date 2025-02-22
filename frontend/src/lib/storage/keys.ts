const STORAGE_KEYS = {
	OPENAI: 'openai-key',
	ELEVENLABS: 'elevenlabs-key'
} as const;

export function getStoredKeys() {
	if (typeof window === 'undefined') return { openaiKey: '', elevenLabsKey: '' };

	return {
		openaiKey: localStorage.getItem(STORAGE_KEYS.OPENAI) || '',
		elevenLabsKey: localStorage.getItem(STORAGE_KEYS.ELEVENLABS) || ''
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
