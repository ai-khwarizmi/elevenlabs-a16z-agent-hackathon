import { writable } from 'svelte/store';

export type DialogField = {
	id: string;
	label: string;
	type: 'text' | 'number' | 'select' | 'checkbox' | 'radio' | 'file' | 'textarea';
	required?: boolean;
	placeholder?: string;
	options?: Array<{ value: string; label: string }>;
	file_upload_path?: string;
	accept?: string;
	default_value?: string;
};

export type DialogOptions = {
	title: string;
	description?: string;
	fields: DialogField[];
	timeout_seconds: number;
	submit_button_text?: string;
	cancel_button_text?: string;
};

export type DialogValues = Record<string, string | number | boolean | File>;

type DialogState = {
	isOpen: boolean;
	options: DialogOptions | null;
	resolve: ((value: DialogValues | null) => void) | null;
};

function createDialogStore() {
	const { subscribe, update } = writable<DialogState>({
		isOpen: false,
		options: null,
		resolve: null
	});

	return {
		subscribe,
		show: (options: DialogOptions): Promise<DialogValues | null> => {
			return new Promise((resolve) => {
				update((state) => ({
					...state,
					isOpen: true,
					options,
					resolve
				}));
			});
		},
		close: (values: DialogValues | null = null) => {
			update((state) => {
				if (state.resolve) {
					state.resolve(values);
				}
				return {
					isOpen: false,
					options: null,
					resolve: null
				};
			});
		}
	};
}

export const dialog = createDialogStore();
