import { fal } from '@fal-ai/client';

interface ValidationResult {
	isValid: boolean;
	error?: string;
}

interface OpenAIError {
	error?: {
		message: string;
	};
}

interface ElevenLabsError {
	detail?: {
		message: string;
	};
}

export async function validateOpenAIKey(key: string): Promise<ValidationResult> {
	try {
		const response = await fetch('https://api.openai.com/v1/models', {
			headers: {
				Authorization: `Bearer ${key}`
			}
		});

		if (response.ok) {
			return { isValid: true };
		} else {
			const error = (await response.json()) as OpenAIError;
			return {
				isValid: false,
				error: error.error?.message || 'Invalid API key'
			};
		}
	} catch {
		return {
			isValid: false,
			error: 'Failed to validate API key'
		};
	}
}

export async function validateElevenLabsKey(key: string): Promise<ValidationResult> {
	try {
		const response = await fetch('https://api.elevenlabs.io/v1/voices', {
			headers: {
				'xi-api-key': key
			}
		});

		if (response.ok) {
			return { isValid: true };
		} else {
			const error = (await response.json()) as ElevenLabsError;
			return {
				isValid: false,
				error: error.detail?.message || 'Invalid API key'
			};
		}
	} catch {
		return {
			isValid: false,
			error: 'Failed to validate API key'
		};
	}
}

export async function validateFalKey(key: string): Promise<ValidationResult> {
	if (key) {
		fal.config({
			credentials: key
		});
		return {
			isValid: true
		};
	}
	return {
		isValid: false,
		error: 'Failed to validate API key'
	};
}
