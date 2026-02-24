import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";

export default class IntegrationsConnect extends BaseCommand {
	static override description =
		"Connect an external service via Composio (opens OAuth flow)";

	static override examples = [
		"<%= config.bin %> integrations:connect gmail",
		'<%= config.bin %> integrations:connect gmail --label "Work Gmail"',
		"<%= config.bin %> integrations:connect slack",
		"<%= config.bin %> integrations:connect google_calendar",
	];

	static override args = {
		toolkit: Args.string({
			description: "Toolkit to connect (e.g. gmail, slack, google_calendar)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		label: Flags.string({
			description: "Label for this connection (e.g. Work Gmail)",
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(IntegrationsConnect);
		const db = getDb(flags.db);

		const { connectToolkit, waitForConnection } = await import(
			"../../services/composio.js"
		);

		this.log(`Connecting ${args.toolkit}...`);

		const { redirectUrl, connectionRequestId } = await connectToolkit(
			db,
			args.toolkit,
			flags.label,
		);

		if (redirectUrl) {
			this.log(`\nOpen this URL to authorize:\n${redirectUrl}`);
			// Try to open browser automatically
			try {
				const { exec } = await import("node:child_process");
				const cmd =
					process.platform === "darwin"
						? "open"
						: process.platform === "win32"
							? "start"
							: "xdg-open";
				exec(`${cmd} "${redirectUrl}"`);
			} catch {
				/* Browser open is best-effort */
			}
		}

		this.log("\nWaiting for authorization...");

		const result = await waitForConnection(
			db,
			connectionRequestId,
			args.toolkit,
			flags.label,
		);

		if (flags.json) {
			this.log(JSON.stringify(result, null, 2));
		} else {
			this.log(`\nConnected! Account ID: ${result.id} (${args.toolkit})`);
		}
	}
}
