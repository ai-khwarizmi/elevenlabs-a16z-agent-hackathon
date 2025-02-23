<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { DialogField, DialogValues } from '$lib/stores/dialog.svelte';
	import { filesystem } from '$lib/stores/filesystem.svelte';

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
			// Read the file as text or binary based on type
			const content = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = () => reject(reader.error);

				if (file.type.startsWith('text/')) {
					reader.readAsText(file);
				} else {
					reader.readAsDataURL(file);
				}
			});

			// Use the virtual filesystem to store the file
			const filePath = `${field.file_upload_path}/${file.name}`;
			await filesystem.writeFile(filePath, content);

			// Update form values with the file path
			formValues[field.id] = filePath;
		} catch (error) {
			console.error('File upload failed:', error);
			// TODO: Show error to user
		}
	}

	function handleSubmit() {
		// Validate required fields
		const missingRequired = fields.filter(
			(field: DialogField) => field.required && !formValues[field.id]
		);

		if (missingRequired.length > 0) {
			// TODO: Show validation errors to user
			return;
		}

		onSubmit(formValues);
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
	transition:fade={{ duration: 200 }}
>
	<div
		class="w-full max-w-lg rounded-lg border border-white/20 bg-black p-6 shadow-2xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby="dialog-title"
	>
		<div class="mb-6 flex flex-col border-b border-white/10 pb-4">
			<h2 id="dialog-title" class="text-2xl font-bold text-white">{title}</h2>
			{#if description}
				<p class="mt-2 text-gray-400">{description}</p>
			{/if}
			<div class="mt-4 text-sm text-[#FF6222]">
				Time remaining: {timeLeft} seconds
			</div>
		</div>

		<form class="space-y-4" on:submit|preventDefault={handleSubmit}>
			{#each fields as field}
				<div>
					<label for={field.id} class="block text-sm font-medium text-white">
						{field.label}
						{#if field.required}
							<span class="text-[#FF2222]">*</span>
						{/if}
					</label>

					{#if field.type === 'textarea'}
						<textarea
							id={field.id}
							bind:value={formValues[field.id]}
							placeholder={field.placeholder}
							required={field.required}
							class="focus:ring-opacity-50 mt-1 block w-full rounded-md border border-white/20 bg-black/50 px-3 py-2 text-white placeholder-gray-400 shadow-sm focus:border-[#FF6222] focus:ring-[#FF6222]"
						/>
					{:else if field.type === 'select'}
						<select
							id={field.id}
							bind:value={formValues[field.id]}
							required={field.required}
							class="focus:ring-opacity-50 mt-1 block w-full rounded-md border border-white/20 bg-black/50 px-3 py-2 text-white shadow-sm focus:border-[#FF6222] focus:ring-[#FF6222]"
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
										class="focus:ring-opacity-50 h-4 w-4 border-white/20 bg-black/50 text-[#FF6222] focus:ring-[#FF6222]"
									/>
									<label for="{field.id}-{option.value}" class="ml-2 block text-sm text-white">
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
								class="focus:ring-opacity-50 h-4 w-4 rounded border-white/20 bg-black/50 text-[#FF6222] focus:ring-[#FF6222]"
							/>
							<label for={field.id} class="ml-2 text-sm text-white">
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
							class="mt-1 block w-full text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-[#FF6222] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#e55820]"
						/>
					{:else}
						<input
							type={field.type}
							id={field.id}
							bind:value={formValues[field.id]}
							placeholder={field.placeholder}
							required={field.required}
							class="focus:ring-opacity-50 mt-1 block w-full rounded-md border border-white/20 bg-black/50 px-3 py-2 text-white placeholder-gray-400 shadow-sm focus:border-[#FF6222] focus:ring-[#FF6222]"
						/>
					{/if}
				</div>
			{/each}

			<div class="mt-6 flex justify-end space-x-3">
				<button
					type="button"
					on:click={onCancel}
					class="rounded-md border border-white/20 bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-white/10 focus:ring-2 focus:ring-[#FF6222] focus:ring-offset-2 focus:outline-none"
				>
					{cancel_button_text}
				</button>
				<button
					type="submit"
					class="rounded-md bg-[#FF6222] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#e55820] focus:ring-2 focus:ring-[#FF6222] focus:ring-offset-2 focus:outline-none"
				>
					{submit_button_text}
				</button>
			</div>
		</form>
	</div>
</div>
