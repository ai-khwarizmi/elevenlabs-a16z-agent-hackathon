<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { DialogField, DialogValues } from '$lib/stores/dialog.svelte';

	type DialogProps = {
		title: string;
		description?: string;
		fields: DialogField[];
		timeout_seconds: number;
		submit_button_text?: string;
		cancel_button_text?: string;
		onSubmit: (values: DialogValues) => void;
		onCancel: () => void;
	};

	let {
		title,
		description,
		fields,
		timeout_seconds,
		submit_button_text = 'Submit',
		cancel_button_text = 'Cancel',
		onSubmit,
		onCancel
	} = $props();

	// Form values state
	let formValues = $state({} as DialogValues);

	// Initialize default values
	$effect(() => {
		for (const field of fields) {
			if (field.default_value !== undefined) {
				formValues[field.id] = field.default_value;
			} else if (field.type === 'checkbox') {
				formValues[field.id] = false;
			} else {
				formValues[field.id] = '';
			}
		}
	});

	// Timer state
	let timeLeft = $state(timeout_seconds);
	let timer: number;

	$effect(() => {
		// Start countdown
		timer = window.setInterval(() => {
			timeLeft--;
			if (timeLeft <= 0) {
				clearInterval(timer);
				onCancel();
			}
		}, 1000);

		// Cleanup on unmount
		return () => {
			clearInterval(timer);
		};
	});

	// Handle file uploads
	async function handleFileUpload(event: Event, field: DialogField) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !field.file_upload_path) return;

		try {
			// Create a FormData object
			const formData = new FormData();
			formData.append('file', file);
			formData.append('path', field.file_upload_path);

			// Upload the file
			const response = await fetch('/api/upload', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error('Upload failed');
			}

			const result = await response.json();
			formValues[field.id] = result.path;
		} catch (error) {
			console.error('File upload failed:', error);
			// TODO: Show error to user
		}
	}

	function handleSubmit() {
		// Validate required fields
		const missingRequired = fields.filter((field) => field.required && !formValues[field.id]);

		if (missingRequired.length > 0) {
			// TODO: Show validation errors to user
			return;
		}

		onSubmit(formValues);
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
	transition:fade={{ duration: 200 }}
>
	<div
		class="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby="dialog-title"
	>
		<div class="mb-6">
			<h2 id="dialog-title" class="text-2xl font-semibold">{title}</h2>
			{#if description}
				<p class="mt-2 text-gray-600">{description}</p>
			{/if}
			<div class="mt-4 text-sm text-gray-500">
				Time remaining: {timeLeft} seconds
			</div>
		</div>

		<form class="space-y-4" on:submit|preventDefault={handleSubmit}>
			{#each fields as field}
				<div>
					<label for={field.id} class="block text-sm font-medium text-gray-700">
						{field.label}
						{#if field.required}
							<span class="text-red-500">*</span>
						{/if}
					</label>

					{#if field.type === 'textarea'}
						<textarea
							id={field.id}
							bind:value={formValues[field.id]}
							placeholder={field.placeholder}
							required={field.required}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						/>
					{:else if field.type === 'select'}
						<select
							id={field.id}
							bind:value={formValues[field.id]}
							required={field.required}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							<option value="">Select an option</option>
							{#each field.options || [] as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					{:else if field.type === 'radio'}
						<div class="mt-1 space-y-2">
							{#each field.options || [] as option}
								<div class="flex items-center">
									<input
										type="radio"
										id="{field.id}-{option.value}"
										name={field.id}
										value={option.value}
										bind:group={formValues[field.id]}
										required={field.required}
										class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<label for="{field.id}-{option.value}" class="ml-2 block text-sm text-gray-700">
										{option.label}
									</label>
								</div>
							{/each}
						</div>
					{:else if field.type === 'checkbox'}
						<div class="mt-1">
							<input
								type="checkbox"
								id={field.id}
								bind:checked={formValues[field.id]}
								required={field.required}
								class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<label for={field.id} class="ml-2 text-sm text-gray-700">
								{field.label}
							</label>
						</div>
					{:else if field.type === 'file'}
						<input
							type="file"
							id={field.id}
							accept={field.accept}
							required={field.required}
							on:change={(e) => handleFileUpload(e, field)}
							class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
						/>
					{:else}
						<input
							type={field.type}
							id={field.id}
							bind:value={formValues[field.id]}
							placeholder={field.placeholder}
							required={field.required}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						/>
					{/if}
				</div>
			{/each}

			<div class="mt-6 flex justify-end space-x-3">
				<button
					type="button"
					on:click={onCancel}
					class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				>
					{cancel_button_text}
				</button>
				<button
					type="submit"
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				>
					{submit_button_text}
				</button>
			</div>
		</form>
	</div>
</div>
