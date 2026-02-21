import { Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { getAuditLog } from "../services/audit.js";
import { formatJson, formatTable } from "../utils/output.js";

export default class Audit extends BaseCommand {
	static override description = "View the audit log of CLI and agent actions";

	static override examples = [
		"<%= config.bin %> audit",
		"<%= config.bin %> audit --last 50",
		"<%= config.bin %> audit --actor human",
		"<%= config.bin %> audit --command contact:add",
		"<%= config.bin %> audit --json",
	];

	static override flags = {
		...BaseCommand.baseFlags,
		last: Flags.integer({
			char: "l",
			description: "Number of entries to show",
			default: 20,
		}),
		actor: Flags.string({
			char: "a",
			description: "Filter by actor (e.g. human, follow-up)",
		}),
		command: Flags.string({
			char: "c",
			description: "Filter by command name (substring match)",
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Audit);
		const db = getDb(flags.db);

		const entries = getAuditLog(db, {
			actor: flags.actor,
			command: flags.command,
			last: flags.last,
		});

		if (flags.json) {
			this.log(formatJson(entries));
			return;
		}

		if (entries.length === 0) {
			this.log("No audit log entries found");
			return;
		}

		this.log(
			formatTable(
				["ID", "Actor", "Command", "Result", "Duration", "Time"],
				entries.map((e) => [
					e.id,
					e.actor,
					e.command,
					e.result ?? "",
					e.duration_ms != null ? `${e.duration_ms}ms` : "",
					e.created_at,
				]),
			),
		);
		this.log(
			`\nShowing ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`,
		);
	}
}
