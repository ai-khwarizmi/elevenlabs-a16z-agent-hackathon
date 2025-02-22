import { Tool, type ToolExecuteFunction } from '$lib/utils/tool.svelte';

/**
 * Tool for executing JavaScript code in a secure sandbox
 */
export const sandboxTool = new Tool(
	{
		name: 'execute_js',
		description:
			'Execute JavaScript code in a secure sandboxed environment. You have full access to the internet, and any libraries that are default available in the browser.',
		parameters: {
			type: 'object',
			properties: {
				code: {
					name: 'code',
					description: 'JavaScript code to execute',
					type: 'string'
				},
				timeout: {
					name: 'timeout',
					description: 'Maximum execution time in milliseconds',
					type: 'number'
				}
			},
			required: ['code']
		}
	},
	(async (args) => {
		console.log('🚀 Sandbox execution requested:', { args });

		if (typeof args !== 'object' || args === null) {
			console.warn('❌ Invalid arguments provided to sandbox');
			return {
				success: false,
				message: 'Invalid arguments'
			};
		}

		const { code } = args;
		const timeout = typeof args.timeout === 'number' ? args.timeout : 5000;
		console.log('⚙️ Sandbox configuration:', { timeout });

		if (typeof code !== 'string') {
			console.warn('❌ Invalid code type provided:', typeof code);
			return {
				success: false,
				message: 'Code must be a string'
			};
		}

		try {
			console.log('🔒 Starting sandboxed code execution');
			const result = await executeSandboxedCode(code, timeout);
			console.log('✅ Sandbox execution completed successfully:', { result });
			return {
				success: true,
				result
			};
		} catch (error) {
			console.error('❌ Sandbox execution failed:', error);
			return {
				success: false,
				message: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}) satisfies ToolExecuteFunction
);

/**
 * Execute code in a sandboxed iframe with strict CSP
 */
async function executeSandboxedCode(code: string, timeout: number): Promise<unknown> {
	return new Promise((resolve, reject) => {
		console.log('🏗️ Creating sandbox iframe');
		// Create sandbox iframe
		const iframe = document.createElement('iframe');

		// Set strict sandbox attributes
		iframe.sandbox.add('allow-scripts');
		console.log('🔒 Sandbox restrictions applied:', iframe.sandbox.value);

		// Set strict CSP
		const csp = [
			"default-src 'none'",
			"script-src 'unsafe-inline'", // Needed to execute the provided code
			"style-src 'unsafe-inline'" // Allow basic styling if needed
		].join('; ');
		console.log('🛡️ Content Security Policy configured:', csp);

		// Create HTML content with CSP
		const html = `
			<!DOCTYPE html>
			<html>
				<head>
					<meta http-equiv="Content-Security-Policy" content="${csp}">
				</head>
				<body>
					<script>
						console.log('🎯 Sandbox environment initialized');
						
						// Setup message handler for results
						window.addEventListener('message', (event) => {
							console.log('📨 Sandbox received message:', event.data);
							if (event.source === window) {
								window.parent.postMessage({
									type: 'sandbox-result',
									result: event.data
								}, '*');
							}
						});

						// Error handler
						window.onerror = (msg, url, line, col, error) => {
							console.error('🚨 Sandbox error:', { msg, line, col });
							window.parent.postMessage({
								type: 'sandbox-error',
								error: {
									message: msg,
									line,
									col
								}
							}, '*');
							return true;
						};

						// Execute the code
						try {
							console.log('▶️ Executing code in sandbox');
							const result = (function() {
								${code}
							})();
							console.log('✅ Code execution completed:', result);
							window.postMessage(result, '*');
						} catch (error) {
							console.error('❌ Code execution failed:', error);
							window.parent.postMessage({
								type: 'sandbox-error',
								error: {
									message: error.message,
									stack: error.stack
								}
							}, '*');
						}
					</script>
				</body>
			</html>
		`;

		// Handle messages from sandbox
		const messageHandler = (event: MessageEvent) => {
			console.log('📬 Received message from sandbox:', event.data);
			if (event.source === iframe.contentWindow) {
				if (event.data.type === 'sandbox-error') {
					console.error('❌ Sandbox reported error:', event.data.error);
					cleanup();
					reject(new Error(event.data.error.message));
				} else if (event.data.type === 'sandbox-result') {
					console.log('✅ Sandbox returned result:', event.data.result);
					cleanup();
					resolve(event.data.result);
				}
			}
		};

		// Handle timeout
		const timeoutId = setTimeout(() => {
			console.warn('⏰ Sandbox execution timed out after', timeout, 'ms');
			cleanup();
			reject(new Error('Execution timed out'));
		}, timeout);

		// Cleanup function
		const cleanup = () => {
			console.log('🧹 Cleaning up sandbox resources');
			clearTimeout(timeoutId);
			window.removeEventListener('message', messageHandler);
			document.body.removeChild(iframe);
		};

		// Setup message listener
		window.addEventListener('message', messageHandler);
		console.log('👂 Message listener attached');

		// Add iframe to page (hidden)
		iframe.style.display = 'none';
		document.body.appendChild(iframe);
		console.log('📦 Sandbox iframe added to page');

		// Write content to iframe
		iframe.srcdoc = html;
		console.log('📝 Code injected into sandbox');
	});
}
