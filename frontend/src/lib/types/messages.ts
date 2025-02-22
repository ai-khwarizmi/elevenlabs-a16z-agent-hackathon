import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export type TimestampedMessage = ChatCompletionMessageParam & {
	timestamp: number;
	name?: string;
};
