import { agents } from '../lib/stores/agents.svelte';
import type { Agent } from '../lib/utils/agent.svelte';
import { createOpenAI } from '$lib/api/ai/openai.svelte';
import { getStoredKeys } from '$lib/storage/keys';
import type { TimestampedMessage } from '$lib/types/messages';
import { agentDoWork } from './stores/agentsWorkLifeCycle.svelte';

async function determineAndActivateNextAgent(
	transcript: TimestampedMessage[],
	agentList: Agent[]
): Promise<void> {
	// Create OpenAI client for GPT-4o
	const { openaiKey } = getStoredKeys();
	if (!openaiKey) {
		console.warn('OpenAI API key not found');
		return;
	}
	const openai = createOpenAI(openaiKey);

	try {
		console.log('Determining next agent... ' + transcript.length);
		// Get agent descriptions with their IDs
		const agentDescriptions = agentList
			.map((agent) => `${agent.id}: ${agent.getMessageLog()[0]?.content || 'No description'}`)
			.join('\n');

		// Ask GPT-4o which agent should be activated
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{
					role: 'system',
					content: `You are a coordinator that decides which agent should be activated based on the conversation transcript. Available agents:\n${agentDescriptions}`
				},
				{
					role: 'user',
					content: `Based on this conversation transcript, which agent should be activated next?\n\nTranscript:\n${JSON.stringify(transcript, null, 2)}`
				}
			],
			tools: [
				{
					type: 'function',
					function: {
						name: 'activate_agent',
						description: 'Activate an agent by their ID',
						parameters: {
							type: 'object',
							properties: {
								agent_id: {
									type: 'string',
									description: 'The ID of the agent to activate'
								}
							},
							required: ['agent_id']
						}
					}
				}
			],
			tool_choice: { type: 'function', function: { name: 'activate_agent' } }
		});

		const toolCall = completion.choices[0].message.tool_calls?.[0];
		if (toolCall?.function.name === 'activate_agent') {
			const { agent_id } = JSON.parse(toolCall.function.arguments);

			const selectedAgent = agentList.find((agent) => agent.id === agent_id);
			if (selectedAgent) {
				console.log(`Activating agent: ${selectedAgent.getName()} (${agent_id})`);
				selectedAgent.makeAgentActive();
			} else {
				console.warn(`Agent with ID ${agent_id} not found`);
			}
		}
	} catch (error) {
		console.error('Error while determining next agent:', error);
	}
}

async function mainLoop() {
	while (true) {
		try {
			// Get all agents from the store
			const agentList: Agent[] = agents.list;

			// Check if all agents are idle
			const allIdle = agentList.every((agent: Agent) => agent.getState() === 'IDLE');

			if (allIdle && agentList.length > 0) {
				/*
					IDLE AGENT LOGIC
				*/
				console.log('All agents are currently idle');

				// Get the global transcript and determine next agent
				const transcript = agents.getGlobalChatlog();
				await determineAndActivateNextAgent(transcript, agentList);

				//wait 10 seconds before checking again
				await new Promise((resolve) => setTimeout(resolve, 10000));
			} else {
				const activeAgent = agentList.find(
					(agent) => agent.getState() === 'VOICE_ACTIVE' || agent.getState() === 'TEXT_ACTIVE'
				);

				if (!activeAgent) {
					console.log('No active agent found');
				} else {
					/*
						HAND RAISING LOGIC
					*/
					console.log('need to figure out if any agents need to raise their hand');
					const activeStartTimestamp = activeAgent.getActiveStartTimestamp();
					if (activeStartTimestamp) {
						const timeSinceActive = Date.now() - activeStartTimestamp;
						console.log('current agent has been active for ', timeSinceActive, 'ms');
						const idleAgents = agentList.filter((agent) => agent.getState() === 'IDLE');
						for (const agent of idleAgents) {
							const urgency = await agent.considerRaisingHand();
							if (urgency && urgency > 7) {
								console.log('agent ', agent.getName(), ' raised hand with urgency ', urgency);
								// kill the active agent, and make the new agent active
								// wait 4 seconds, then make them active
								await new Promise((resolve) => setTimeout(resolve, 4000));
								activeAgent.makeIdle();
								agent.makeAgentActive();
							} else if (urgency === null) {
								//agent doesnt want to raise their hand, lets see if they want to do work
								await agentDoWork(agent);
							}
						}
					} else {
						console.log('current agent has not been active for long enough');
					}
				}
			}
		} catch (error) {
			console.error('Error in main loop:', error);
		}

		// Wait a bit before next check to avoid tight loop
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

let mainLoopStarted = false;

export function startMainLoop() {
	if (!mainLoopStarted) {
		mainLoopStarted = true;
		mainLoop();
	}
}
