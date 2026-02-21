import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { runAgent } from "../../services/agent-runner.js";
import { getAgent } from "../../services/subagents.js";

export default class AgentMeetingPrep extends BaseCommand {
	static override description =
		"Prepare a briefing for an upcoming meeting with a contact";

	static override args = {
		contact: Args.string({
			description: "Contact name to prepare for",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		model: Flags.string({ description: "Model to use" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(AgentMeetingPrep);
		const agent = getAgent("meeting-prep")!;

		await runAgent({
			prompt: `Prepare a meeting briefing for "${args.contact}". Compile all relevant context about this contact.`,
			systemPrompt: agent.prompt,
			dbPath: flags.db,
			model: flags.model,
			verbose: flags.verbose,
			agentName: "meeting-prep",
			onText: (text) => this.log(text),
		});
	}
}
