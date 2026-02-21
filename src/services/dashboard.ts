import { eq, sql } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { listContacts } from "./contacts.js";
import { listDeals, pipelineView } from "./deals.js";
import { listInteractions } from "./interactions.js";
import { listTasks } from "./tasks.js";

interface DashboardData {
	pipelineValue: number;
	dealsByStage: Record<string, { count: number; value: number }>;
	overdueTasks: Array<{
		id: number;
		title: string;
		due: string;
		contact_name: string | null;
	}>;
	tasksDueToday: Array<{
		id: number;
		title: string;
		contact_name: string | null;
	}>;
	staleContacts: Array<{ id: number; name: string; updated_at: string }>;
	closingSoon: Array<{
		id: number;
		title: string;
		value: number | null;
		expected_close: string | null;
	}>;
	pendingActions: number;
	recentActivityCount: number;
}

export function getDashboard(db: PipelineDB): DashboardData {
	// Deal summary by stage
	const { grouped } = pipelineView(db);
	const dealsByStage: Record<string, { count: number; value: number }> = {};
	let pipelineValue = 0;

	for (const [stage, deals] of Object.entries(grouped)) {
		const openDeals = deals.filter(
			(d) => d.won === null || d.won === undefined,
		);
		if (openDeals.length === 0) continue;
		const stageValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
		dealsByStage[stage] = { count: openDeals.length, value: stageValue };
		pipelineValue += stageValue;
	}

	// Overdue tasks
	const overdueTasks = listTasks(db, { overdue: true }).map((t) => ({
		id: t.id,
		title: t.title,
		due: t.due!,
		contact_name: t.contact_name,
	}));

	// Tasks due today
	const tasksDueToday = listTasks(db, { dueToday: true }).map((t) => ({
		id: t.id,
		title: t.title,
		contact_name: t.contact_name,
	}));

	// Stale contacts (no update in 14 days)
	const staleContacts = listContacts(db, { staleDays: 14 }).map((c) => ({
		id: c.id,
		name: c.name,
		updated_at: c.updated_at,
	}));

	// Deals closing within 7 days
	const closingSoon = listDeals(db, { closingDays: 7 }).map((d) => ({
		id: d.id,
		title: d.title,
		value: d.value,
		expected_close: d.expected_close,
	}));

	// Pending actions count
	const pendingResult = db
		.select({ count: sql<number>`count(*)` })
		.from(schema.pendingActions)
		.where(eq(schema.pendingActions.status, "pending"))
		.get();
	const pendingActions = pendingResult?.count ?? 0;

	// Recent interactions (last 7 days)
	const recentActivityCount = listInteractions(db, { lastDays: 7 }).length;

	return {
		pipelineValue,
		dealsByStage,
		overdueTasks,
		tasksDueToday,
		staleContacts,
		closingSoon,
		pendingActions,
		recentActivityCount,
	};
}
