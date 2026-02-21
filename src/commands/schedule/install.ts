import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDbPath } from "../../db/index.js";

const MARKER = "# pipeline-crm-schedule";

export default class ScheduleInstall extends BaseCommand {
	static override description = "Install a crontab entry to run schedules";

	static override flags = {
		...BaseCommand.baseFlags,
		every: Flags.integer({
			description: "Run every N minutes",
			default: 15,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(ScheduleInstall);
		const minutes = flags.every;

		const binPath = resolve(
			new URL("../../../bin/run.js", import.meta.url).pathname,
		);
		const dbPath = getDbPath(flags.db);
		const logDir = join(homedir(), ".pipeline", "logs");
		const logFile = join(logDir, "schedule.log");

		mkdirSync(logDir, { recursive: true });

		const cronLine = `*/${minutes} * * * * node ${binPath} schedule:run --db ${dbPath} >> ${logFile} 2>&1 ${MARKER}`;

		let existing = "";
		try {
			existing = execSync("crontab -l 2>/dev/null", {
				encoding: "utf-8",
			});
		} catch {
			// no crontab yet
		}

		// Remove any existing pipeline entry
		const lines = existing.split("\n").filter((l) => !l.includes(MARKER));
		lines.push(cronLine);

		const newCrontab = lines.filter((l) => l.trim() !== "").join("\n") + "\n";

		execSync("crontab -", {
			input: newCrontab,
			encoding: "utf-8",
		});

		this.log(`Installed crontab entry (every ${minutes} minutes)`);
		this.log(`Logs: ${logFile}`);
	}
}
