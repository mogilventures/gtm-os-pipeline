import { eq, sql } from "drizzle-orm";
import { loadConfig } from "../config.js";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { emitEvent } from "./events.js";

// ── Projects ────────────────────────────────────────────────────

interface AddProjectInput {
	name: string;
	dealId?: number;
	contactId?: number;
	orgId?: number;
	value?: number;
	stage?: string;
	notes?: string;
}

export function addProject(db: PipelineDB, input: AddProjectInput) {
	const config = loadConfig();
	const stages = config.delivery.stages;

	const stage = input.stage || stages[0];
	if (!stages.includes(stage)) {
		throw new Error(
			`Invalid delivery stage "${stage}". Valid stages: ${stages.join(", ")}`,
		);
	}

	const project = db
		.insert(schema.projects)
		.values({
			name: input.name,
			deal_id: input.dealId,
			contact_id: input.contactId,
			org_id: input.orgId,
			value: input.value,
			stage,
			notes: input.notes,
		})
		.returning()
		.get();

	emitEvent(db, "project_created", "project", project.id, {
		name: project.name,
		stage: project.stage,
		value: project.value,
	});

	return project;
}

export function listProjects(
	db: PipelineDB,
	filters?: {
		stage?: string;
		contactId?: number;
		orgId?: number;
		active?: boolean;
	},
) {
	const rows = db
		.select({
			id: schema.projects.id,
			name: schema.projects.name,
			stage: schema.projects.stage,
			value: schema.projects.value,
			contact_name: schema.people.name,
			org_name: schema.organizations.name,
			completed_at: schema.projects.completed_at,
			updated_at: schema.projects.updated_at,
			created_at: schema.projects.created_at,
		})
		.from(schema.projects)
		.leftJoin(
			schema.contacts,
			eq(schema.projects.contact_id, schema.contacts.id),
		)
		.leftJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.leftJoin(
			schema.organizations,
			eq(schema.projects.org_id, schema.organizations.id),
		)
		.all();

	let filtered = rows;

	const active = filters?.active ?? true;
	if (active) {
		filtered = filtered.filter((r) => !r.completed_at);
	}
	if (filters?.stage) {
		filtered = filtered.filter((r) => r.stage === filters.stage);
	}
	if (filters?.contactId) {
		const projectIds = db
			.select({ id: schema.projects.id })
			.from(schema.projects)
			.where(eq(schema.projects.contact_id, filters.contactId))
			.all()
			.map((p) => p.id);
		filtered = filtered.filter((r) => projectIds.includes(r.id));
	}
	if (filters?.orgId) {
		const projectIds = db
			.select({ id: schema.projects.id })
			.from(schema.projects)
			.where(eq(schema.projects.org_id, filters.orgId))
			.all()
			.map((p) => p.id);
		filtered = filtered.filter((r) => projectIds.includes(r.id));
	}

	// Add milestone progress counts
	return filtered.map((r) => {
		const total = db
			.select({ count: sql<number>`count(*)` })
			.from(schema.milestones)
			.where(eq(schema.milestones.project_id, r.id))
			.get()!.count;
		const complete = db
			.select({ count: sql<number>`count(*)` })
			.from(schema.milestones)
			.where(eq(schema.milestones.project_id, r.id))
			.all().length
			? db
					.select({ count: sql<number>`count(*)` })
					.from(schema.milestones)
					.where(eq(schema.milestones.project_id, r.id))
					.all()
					.filter(() => true).length
			: 0;
		const completedCount = db
			.select()
			.from(schema.milestones)
			.where(eq(schema.milestones.project_id, r.id))
			.all()
			.filter((m) => m.completed).length;
		return {
			...r,
			milestones_complete: completedCount,
			milestones_total: total,
		};
	});
}

export function showProject(db: PipelineDB, projectId: number) {
	const project = db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.get();
	if (!project) return null;

	const milestones = db
		.select()
		.from(schema.milestones)
		.where(eq(schema.milestones.project_id, projectId))
		.all();

	const tasks = db
		.select()
		.from(schema.tasks)
		.all()
		.filter(
			(t) =>
				(t as Record<string, unknown>).project_id === projectId && !t.completed,
		);

	let contact = null;
	if (project.contact_id) {
		const c = db
			.select({
				id: schema.contacts.id,
				name: schema.people.name,
				email: schema.people.email,
			})
			.from(schema.contacts)
			.leftJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
			.where(eq(schema.contacts.id, project.contact_id))
			.get();
		contact = c ?? null;
	}

	let deal = null;
	if (project.deal_id) {
		deal =
			db
				.select()
				.from(schema.deals)
				.where(eq(schema.deals.id, project.deal_id))
				.get() ?? null;
	}

	return { project, milestones, tasks, contact, deal };
}

export function moveProject(db: PipelineDB, projectId: number, stage: string) {
	const config = loadConfig();
	if (!config.delivery.stages.includes(stage)) {
		throw new Error(
			`Invalid delivery stage "${stage}". Valid stages: ${config.delivery.stages.join(", ")}`,
		);
	}

	const old = db
		.select({ stage: schema.projects.stage })
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.get();

	db.update(schema.projects)
		.set({ stage, updated_at: new Date().toISOString() })
		.where(eq(schema.projects.id, projectId))
		.run();

	emitEvent(db, "project_stage_changed", "project", projectId, {
		from_stage: old?.stage,
		to_stage: stage,
	});
}

export function closeProject(db: PipelineDB, projectId: number) {
	const now = new Date().toISOString();
	db.update(schema.projects)
		.set({
			stage: "complete",
			completed_at: now,
			updated_at: now,
		})
		.where(eq(schema.projects.id, projectId))
		.run();

	emitEvent(db, "project_completed", "project", projectId, {});
}

export function getProjectsForFuzzy(db: PipelineDB) {
	return db
		.select({ id: schema.projects.id, name: schema.projects.name })
		.from(schema.projects)
		.all();
}

export function createProjectFromDeal(db: PipelineDB, dealId: number) {
	const deal = db
		.select()
		.from(schema.deals)
		.where(eq(schema.deals.id, dealId))
		.get();
	if (!deal) throw new Error(`Deal ${dealId} not found`);

	return addProject(db, {
		name: deal.title,
		dealId: deal.id,
		contactId: deal.contact_id ?? undefined,
		orgId: deal.org_id ?? undefined,
		value: deal.value ?? undefined,
		stage: "kickoff",
	});
}

// ── Milestones ──────────────────────────────────────────────────

interface AddMilestoneInput {
	projectId: number;
	title: string;
	description?: string;
	contactId?: number;
	due?: string;
}

export function addMilestone(db: PipelineDB, input: AddMilestoneInput) {
	const milestone = db
		.insert(schema.milestones)
		.values({
			project_id: input.projectId,
			title: input.title,
			description: input.description,
			contact_id: input.contactId,
			due: input.due,
		})
		.returning()
		.get();

	// Touch project updated_at
	db.update(schema.projects)
		.set({ updated_at: new Date().toISOString() })
		.where(eq(schema.projects.id, input.projectId))
		.run();

	emitEvent(db, "milestone_created", "milestone", milestone.id, {
		title: milestone.title,
		project_id: input.projectId,
	});

	return milestone;
}

export function listMilestones(
	db: PipelineDB,
	filters?: {
		projectId?: number;
		overdue?: boolean;
		upcoming?: boolean;
		completed?: boolean;
	},
) {
	let rows = db
		.select({
			id: schema.milestones.id,
			title: schema.milestones.title,
			description: schema.milestones.description,
			due: schema.milestones.due,
			completed: schema.milestones.completed,
			completed_at: schema.milestones.completed_at,
			project_id: schema.milestones.project_id,
			project_name: schema.projects.name,
			created_at: schema.milestones.created_at,
		})
		.from(schema.milestones)
		.leftJoin(
			schema.projects,
			eq(schema.milestones.project_id, schema.projects.id),
		)
		.all();

	if (filters?.projectId) {
		rows = rows.filter((r) => r.project_id === filters.projectId);
	}

	const today = new Date().toISOString().split("T")[0];

	if (filters?.overdue) {
		rows = rows.filter((r) => r.due != null && r.due < today && !r.completed);
	}
	if (filters?.upcoming) {
		const weekOut = new Date();
		weekOut.setDate(weekOut.getDate() + 7);
		const weekStr = weekOut.toISOString().split("T")[0];
		rows = rows.filter(
			(r) =>
				r.due != null && r.due >= today && r.due <= weekStr && !r.completed,
		);
	}
	if (filters?.completed !== undefined) {
		rows = rows.filter((r) => r.completed === filters.completed);
	}

	return rows;
}

export function completeMilestone(db: PipelineDB, milestoneId: number) {
	const now = new Date().toISOString();

	const milestone = db
		.select()
		.from(schema.milestones)
		.where(eq(schema.milestones.id, milestoneId))
		.get();
	if (!milestone) throw new Error(`Milestone ${milestoneId} not found`);

	db.update(schema.milestones)
		.set({ completed: true, completed_at: now, updated_at: now })
		.where(eq(schema.milestones.id, milestoneId))
		.run();

	// Touch project updated_at
	db.update(schema.projects)
		.set({ updated_at: now })
		.where(eq(schema.projects.id, milestone.project_id))
		.run();

	emitEvent(db, "milestone_completed", "milestone", milestoneId, {
		title: milestone.title,
		project_id: milestone.project_id,
	});
}

export function getMilestonesForFuzzy(db: PipelineDB) {
	return db
		.select({ id: schema.milestones.id, name: schema.milestones.title })
		.from(schema.milestones)
		.all();
}
