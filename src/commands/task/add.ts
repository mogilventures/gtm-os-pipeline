import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addTask } from "../../services/tasks.js";
import { parseDate } from "../../utils/dates.js";
import { formatJson } from "../../utils/output.js";
import { resolveContactId, resolveDealId } from "../../utils/resolve.js";

export default class TaskAdd extends BaseCommand {
	static override description = "Add a new task";

	static override examples = [
		'<%= config.bin %> task:add "Follow up with Jane" --contact jane --due tomorrow',
	];

	static override args = {
		title: Args.string({ description: "Task title", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		contact: Flags.string({ description: "Contact name (fuzzy match)" }),
		deal: Flags.string({ description: "Deal name (fuzzy match)" }),
		due: Flags.string({
			description: "Due date (tomorrow, next week, 2026-03-01)",
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(TaskAdd);
		const db = getDb(flags.db);

		const contactId = flags.contact
			? (await resolveContactId(db, flags.contact)).id
			: undefined;
		const dealId = flags.deal ? await resolveDealId(db, flags.deal) : undefined;

		const task = addTask(db, {
			title: args.title,
			contactId,
			dealId,
			due: flags.due ? parseDate(flags.due) : undefined,
		});

		if (flags.json) {
			this.log(formatJson(task));
		} else if (flags.quiet) {
			this.log(String(task.id));
		} else {
			this.log(
				`Added task: ${task.title} (id: ${task.id}${task.due ? `, due: ${task.due}` : ""})`,
			);
		}
	}
}
