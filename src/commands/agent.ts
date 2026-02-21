import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { runAgent } from "../services/agent-runner.js";

const SYSTEM_PROMPT = `You are a CRM assistant for a developer-founder. You have access to a local CRM database through MCP tools.

Your capabilities:
- Search and manage contacts, organizations, and deals
- Log interactions (emails, calls, meetings, notes)
- Analyze relationships between entities
- Propose actions for the user to approve

When the user asks about their pipeline, contacts, or deals, use the available CRM tools to look up real data.
When suggesting actions (sending emails, updating records), use the propose_action tool so the user can review and approve.

Be concise and actionable. Format output for terminal readability.`;

export default class Agent extends BaseCommand {
	static override description = "Chat with AI agent about your CRM";

	static override examples = [
		'<%= config.bin %> agent "summarize my pipeline"',
		'<%= config.bin %> agent "who should I follow up with?"',
	];

	static override args = {
		prompt: Args.string({
			description: "Your question or instruction",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		model: Flags.string({ description: "Model to use" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Agent);

		await runAgent({
			prompt: args.prompt,
			systemPrompt: SYSTEM_PROMPT,
			dbPath: flags.db,
			model: flags.model,
			verbose: flags.verbose,
			onText: (text) => this.log(text),
		});
	}
}
