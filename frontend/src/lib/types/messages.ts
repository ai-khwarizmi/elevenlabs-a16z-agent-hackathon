import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

type UniqueId = string;

export function generateUniqueId(): UniqueId {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export type TimestampedMessage = ChatCompletionMessageParam & {
	id: UniqueId;
	timestamp: number;
	name: string;
};
