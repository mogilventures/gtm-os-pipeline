import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { completeTask, getTasksForFuzzy } from "../../services/tasks.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class TaskDone extends BaseCommand {
	static override description = "Mark a task as done";

	static override args = {
		name: Args.string({ description: "Task name or index (fuzzy match)", required: true }),
	};

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { args, flags } = await this.parse(TaskDone);
		const db = getDb(flags.db);

		const tasks = getTasksForFuzzy(db);

		// Try matching by numeric index first
		const index = Number.parseInt(args.name, 10);
		let taskId: number;
		let taskName: string;

		if (!Number.isNaN(index) && index > 0 && index <= tasks.length) {
			taskId = tasks[index - 1].id;
			taskName = tasks[index - 1].name;
		} else {
			const match = await fuzzyResolve(tasks, args.name, "task");
			taskId = match.id;
			taskName = match.name;
		}

		completeTask(db, taskId);
		this.log(`Completed: ${taskName}`);
	}
}
