import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { runAgent } from "../../services/agent-runner.js";
import { getAgent } from "../../services/subagents.js";

export default class AgentTaskAutomator extends BaseCommand {
	static override description =
		"Ensure every active deal has appropriate tasks and flag overdue items";

	static override flags = {
		...BaseCommand.baseFlags,
		model: Flags.string({ description: "Model to use" }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(AgentTaskAutomator);
		const agent = getAgent("task-automator")!;

		await runAgent({
			prompt:
				"Check all active deals for missing tasks. Flag overdue tasks. Propose new tasks where needed.",
			systemPrompt: agent.prompt,
			dbPath: flags.db,
			model: flags.model,
			verbose: flags.verbose,
			agentName: "task-automator",
			onText: (text) => this.log(text),
		});
	}
}
