import { execSync } from "node:child_process";
import { BaseCommand } from "../../base-command.js";

const MARKER = "# pipeline-crm-schedule";

export default class ScheduleUninstall extends BaseCommand {
	static override description = "Remove the pipeline crontab entry";

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		await this.parse(ScheduleUninstall);

		let existing = "";
		try {
			existing = execSync("crontab -l 2>/dev/null", {
				encoding: "utf-8",
			});
		} catch {
			this.log("No crontab found.");
			return;
		}

		const lines = existing.split("\n").filter((l) => !l.includes(MARKER));

		const remaining = lines.filter((l) => l.trim() !== "");

		if (remaining.length === 0) {
			execSync("crontab -r 2>/dev/null", { encoding: "utf-8" });
		} else {
			execSync("crontab -", {
				input: remaining.join("\n") + "\n",
				encoding: "utf-8",
			});
		}

		this.log("Removed crontab entry");
	}
}
