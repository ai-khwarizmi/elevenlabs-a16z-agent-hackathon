import OpenAI from 'openai';

export function createOpenAI(apiKey: string) {
	return new OpenAI({
		apiKey,
		dangerouslyAllowBrowser: true // Required for browser usage
	});
}
