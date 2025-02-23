import { Tool, type ToolExecuteFunction } from '$lib/utils/tool.svelte';
import { dialog } from '$lib/stores/dialog.svelte';
import type { DialogField, DialogOptions } from '$lib/stores/dialog.svelte';

/**
 * Tool for presenting dialog forms to users and getting their input
 */
export const dialogTool = new Tool(
	{
		name: 'show_dialog',
		description: `
Present a dialog form to the user and wait for their response. The dialog will automatically close after the timeout.
You can create forms with various input types including text, number, select, checkbox, radio, and file upload.
For file uploads, specify the target path in the virtual filesystem where the file should be stored.
The dialog will show a countdown timer to indicate when it will close.

Rules:
1. Only use this for files that you need to solve the user's problem.
2. Do not ask the user to answer questions in a dialog
3. Do not ask the user to solve the problem themselves using the dialog
`,
		parameters: {
			type: 'object',
			properties: {
				title: {
					name: 'title',
					type: 'string',
					description: 'Title of the dialog'
				},
				description: {
					name: 'description',
					type: 'string',
					description: 'Optional description text to show below the title'
				},
				timeout_seconds: {
					name: 'timeout_seconds',
					type: 'number',
					description:
						'Number of seconds before the dialog automatically closes. Maximum 300 seconds (5 minutes).'
				},
				field_id: {
					name: 'field_id',
					type: 'string',
					description: 'Unique identifier for the field'
				},
				field_label: {
					name: 'field_label',
					type: 'string',
					description: 'Label text for the field'
				},
				field_type: {
					name: 'field_type',
					type: 'string',
					description: 'Type of form field',
					enum: ['text', 'number', 'select', 'checkbox', 'radio', 'file', 'textarea']
				},
				field_required: {
					name: 'field_required',
					type: 'boolean',
					description: 'Whether the field is required'
				},
				field_placeholder: {
					name: 'field_placeholder',
					type: 'string',
					description: 'Placeholder text for text/number/textarea fields'
				},
				field_options: {
					name: 'field_options',
					type: 'string',
					description:
						'JSON string of options for select/radio fields, format: [{"value": "...", "label": "..."}]'
				},
				field_file_upload_path: {
					name: 'field_file_upload_path',
					type: 'string',
					description:
						'For file uploads: the path in the virtual filesystem where the file should be stored'
				},
				field_accept: {
					name: 'field_accept',
					type: 'string',
					description: 'For file uploads: accepted file types (e.g., ".pdf,.doc,image/*")'
				},
				field_default_value: {
					name: 'field_default_value',
					type: 'string',
					description: 'Default value for the field'
				},
				submit_button_text: {
					name: 'submit_button_text',
					type: 'string',
					description: 'Text to show on the submit button'
				},
				cancel_button_text: {
					name: 'cancel_button_text',
					type: 'string',
					description: 'Text to show on the cancel button'
				}
			},
			required: ['title', 'field_id', 'field_label', 'field_type', 'timeout_seconds']
		}
	},
	(async (args) => {
		if (typeof args !== 'object' || args === null) {
			return {
				success: false,
				message: 'Invalid arguments'
			};
		}

		const {
			title,
			field_id,
			field_label,
			field_type,
			field_required,
			field_placeholder,
			field_options,
			field_file_upload_path,
			field_accept,
			field_default_value,
			timeout_seconds
		} = args;

		// Validate required fields
		if (
			typeof title !== 'string' ||
			typeof field_id !== 'string' ||
			typeof field_label !== 'string' ||
			typeof field_type !== 'string' ||
			typeof timeout_seconds !== 'number'
		) {
			return {
				success: false,
				message: 'Missing or invalid required fields'
			};
		}

		if (timeout_seconds <= 0 || timeout_seconds > 300) {
			return {
				success: false,
				message: 'Timeout must be between 1 and 300 seconds'
			};
		}

		// Create the field object
		const field: DialogField = {
			id: field_id,
			label: field_label,
			type: field_type as DialogField['type'],
			required: field_required as boolean | undefined,
			placeholder: field_placeholder as string | undefined,
			file_upload_path: field_file_upload_path as string | undefined,
			accept: field_accept as string | undefined,
			default_value: field_default_value as string | undefined
		};

		// Parse options if provided
		if (typeof field_options === 'string') {
			try {
				field.options = JSON.parse(field_options);
			} catch {
				return {
					success: false,
					message: 'Invalid field options JSON'
				};
			}
		}

		try {
			// Convert the args to DialogOptions
			const options: DialogOptions = {
				title,
				description: args.description as string | undefined,
				fields: [field],
				timeout_seconds,
				submit_button_text: args.submit_button_text as string | undefined,
				cancel_button_text: args.cancel_button_text as string | undefined
			};

			// Show the dialog and wait for user input
			const result = await dialog.show(options);

			if (!result) {
				return {
					success: false,
					message: 'Dialog was cancelled or timed out'
				};
			}

			// Get the value for the single field we created
			const fieldValue = result[field_id];

			console.log('fieldValue', fieldValue);
			return {
				success: true,
				dialogOutput: JSON.stringify({
					value: fieldValue
				})
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}) satisfies ToolExecuteFunction
);
