import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listTasks } from "../../services/tasks.js";
import { formatJson, formatTable } from "../../utils/output.js";
import { resolveContactId, resolveDealId } from "../../utils/resolve.js";

export default class TaskList extends BaseCommand {
	static override description = "List tasks";

	static override flags = {
		...BaseCommand.baseFlags,
		due: Flags.string({ description: "Filter: 'today'" }),
		overdue: Flags.boolean({ description: "Show overdue tasks only" }),
		contact: Flags.string({ description: "Filter by contact (fuzzy match)" }),
		deal: Flags.string({ description: "Filter by deal (fuzzy match)" }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(TaskList);
		const db = getDb(flags.db);

		const contactId = flags.contact
			? (await resolveContactId(db, flags.contact)).id
			: undefined;
		const dealId = flags.deal ? await resolveDealId(db, flags.deal) : undefined;

		const tasks = listTasks(db, {
			dueToday: flags.due === "today",
			overdue: flags.overdue,
			contactId,
			dealId,
		});

		if (flags.json) {
			this.log(formatJson(tasks));
			return;
		}

		if (tasks.length === 0) {
			this.log("No tasks found.");
			return;
		}

		this.log(
			formatTable(
				["ID", "Title", "Due", "Contact", "Deal"],
				tasks.map((t) => [t.id, t.title, t.due, t.contact_name, t.deal_title]),
			),
		);
	}
}
