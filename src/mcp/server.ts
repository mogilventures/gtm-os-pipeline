// @ts-nocheck — MCP SDK types don't resolve via Node16 moduleResolution wildcard exports
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db/index.js";
import { getRegisteredActionTypes } from "../services/action-handlers.js";
import {
	editContact,
	listContacts,
	showContact,
} from "../services/contacts.js";
import { getFields, setField } from "../services/custom-fields.js";
import { getDashboard } from "../services/dashboard.js";
import { listDeals } from "../services/deals.js";
import { createEdge, getRelated, resolveEntity } from "../services/graph.js";
import { listInteractions } from "../services/interactions.js";
import { listOrganizations } from "../services/organizations.js";
import { searchAll } from "../services/search.js";
import { listTasks } from "../services/tasks.js";
import { getTimeline } from "../services/timeline.js";

// Parse CLI args
const dbArgIdx = process.argv.indexOf("--db");
const dbPath = dbArgIdx !== -1 ? process.argv[dbArgIdx + 1] : undefined;
const agentNameIdx = process.argv.indexOf("--agent-name");
const agentName =
	agentNameIdx !== -1 ? process.argv[agentNameIdx + 1] : undefined;
const runIdIdx = process.argv.indexOf("--run-id");
const runId = runIdIdx !== -1 ? process.argv[runIdIdx + 1] : undefined;

const db = getDb(dbPath);

const server = new McpServer(
	{ name: "pipeline-crm", version: "0.1.0" },
	{ capabilities: { tools: {} } },
);

server.registerTool(
	"search_contacts",
	{
		description: "Search contacts by name, email, company, or tags",
		inputSchema: {
			query: z.string().optional().describe("Name or email to search for"),
			tag: z.string().optional().describe("Filter by tag"),
			org: z.string().optional().describe("Filter by organization name"),
			warmth: z
				.string()
				.optional()
				.describe("Filter by warmth (cold/warm/hot)"),
		},
	},
	async ({ query, tag, org, warmth }) => {
		let contacts = listContacts(db, { tag, org, warmth });
		if (query) {
			const q = query.toLowerCase();
			contacts = contacts.filter(
				(c) =>
					c.name.toLowerCase().includes(q) ||
					c.email?.toLowerCase().includes(q),
			);
		}
		return {
			content: [{ type: "text", text: JSON.stringify(contacts, null, 2) }],
		};
	},
);

server.registerTool(
	"get_stale_contacts",
	{
		description: "Get contacts with no interaction in N days",
		inputSchema: {
			days: z.number().describe("Number of days since last interaction"),
		},
	},
	async ({ days }) => {
		const contacts = listContacts(db, { staleDays: days });
		return {
			content: [{ type: "text", text: JSON.stringify(contacts, null, 2) }],
		};
	},
);

server.registerTool(
	"get_contact_with_history",
	{
		description: "Get full contact record with interactions, deals, and tasks",
		inputSchema: { contact_id: z.number().describe("Contact ID") },
	},
	async ({ contact_id }) => {
		const detail = showContact(db, contact_id);
		if (!detail)
			return { content: [{ type: "text", text: "Contact not found" }] };
		return {
			content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
		};
	},
);

server.registerTool(
	"list_deals",
	{
		description: "List deals with optional filters",
		inputSchema: {
			stage: z.string().optional().describe("Filter by stage"),
			priority: z.string().optional().describe("Filter by priority"),
		},
	},
	async ({ stage, priority }) => {
		const deals = listDeals(db, { stage, priority });
		return {
			content: [{ type: "text", text: JSON.stringify(deals, null, 2) }],
		};
	},
);

server.registerTool(
	"search_organizations",
	{
		description: "Search organizations",
		inputSchema: {
			industry: z.string().optional().describe("Filter by industry"),
			tag: z.string().optional().describe("Filter by tag"),
		},
	},
	async ({ industry, tag }) => {
		const orgs = listOrganizations(db, { industry, tag });
		return { content: [{ type: "text", text: JSON.stringify(orgs, null, 2) }] };
	},
);

server.registerTool(
	"get_related",
	{
		description: "Get all entities related to a given entity (graph traversal)",
		inputSchema: {
			name: z.string().describe("Entity name (person, org, or deal)"),
		},
	},
	async ({ name }) => {
		const entity = resolveEntity(db, name);
		if (!entity)
			return {
				content: [{ type: "text", text: `No entity found matching "${name}"` }],
			};
		const related = getRelated(db, entity);
		return {
			content: [
				{ type: "text", text: JSON.stringify({ entity, related }, null, 2) },
			],
		};
	},
);

server.registerTool(
	"propose_action",
	{
		description: `Propose an action for human approval. Available action types: ${getRegisteredActionTypes().join(", ")}`,
		inputSchema: {
			action_type: z
				.string()
				.describe(`Type of action: ${getRegisteredActionTypes().join(", ")}`),
			payload: z.string().describe("Action payload as JSON string"),
			reasoning: z.string().describe("Why this action is recommended"),
		},
	},
	async ({ action_type, payload, reasoning }) => {
		const parsedPayload = JSON.parse(payload);

		// Write to agent_memory if we have agent context
		let memoryId: number | undefined;
		if (agentName && runId) {
			const mem = db
				.insert(schema.agentMemory)
				.values({
					agent_name: agentName,
					run_id: runId,
					contact_id: parsedPayload.contact_id as number | undefined,
					deal_id: parsedPayload.deal_id as number | undefined,
					action_type,
					payload: parsedPayload,
					reasoning,
				})
				.returning()
				.get();
			memoryId = mem.id;
		}

		const action = db
			.insert(schema.pendingActions)
			.values({
				action_type,
				payload: parsedPayload,
				reasoning,
				agent_name: agentName,
				run_id: runId,
				memory_id: memoryId,
			})
			.returning()
			.get();
		return {
			content: [
				{
					type: "text",
					text: `Action proposed (id: ${action.id}). Run 'pipeline approve' to review.`,
				},
			],
		};
	},
);

server.registerTool(
	"update_contact",
	{
		description: "Update a contact's fields",
		inputSchema: {
			contact_id: z.number().describe("Contact ID"),
			role: z.string().optional().describe("New role"),
			warmth: z.string().optional().describe("New warmth"),
			org: z.string().optional().describe("New organization"),
		},
	},
	async ({ contact_id, role, warmth, org }) => {
		editContact(db, contact_id, { role, warmth, org });
		return {
			content: [{ type: "text", text: `Contact ${contact_id} updated.` }],
		};
	},
);

server.registerTool(
	"update_person",
	{
		description: "Update a person's fields",
		inputSchema: {
			person_id: z.number().describe("Person ID"),
			phone: z.string().optional().describe("Phone number"),
			linkedin: z.string().optional().describe("LinkedIn URL"),
			twitter: z.string().optional().describe("Twitter handle"),
			location: z.string().optional().describe("Location"),
		},
	},
	async ({ person_id, phone, linkedin, twitter, location }) => {
		const updates = { updated_at: new Date().toISOString() };
		if (phone !== undefined) Object.assign(updates, { phone });
		if (linkedin !== undefined) Object.assign(updates, { linkedin });
		if (twitter !== undefined) Object.assign(updates, { twitter });
		if (location !== undefined) Object.assign(updates, { location });
		db.update(schema.people)
			.set(updates)
			.where(eq(schema.people.id, person_id))
			.run();
		return {
			content: [{ type: "text", text: `Person ${person_id} updated.` }],
		};
	},
);

server.registerTool(
	"update_organization",
	{
		description: "Update an organization's fields",
		inputSchema: {
			org_id: z.number().describe("Organization ID"),
			domain: z.string().optional().describe("Domain"),
			industry: z.string().optional().describe("Industry"),
			size: z.string().optional().describe("Company size"),
			location: z.string().optional().describe("Location"),
		},
	},
	async ({ org_id, domain, industry, size, location }) => {
		const updates = { updated_at: new Date().toISOString() };
		if (domain !== undefined) Object.assign(updates, { domain });
		if (industry !== undefined) Object.assign(updates, { industry });
		if (size !== undefined) Object.assign(updates, { size });
		if (location !== undefined) Object.assign(updates, { location });
		db.update(schema.organizations)
			.set(updates)
			.where(eq(schema.organizations.id, org_id))
			.run();
		return {
			content: [{ type: "text", text: `Organization ${org_id} updated.` }],
		};
	},
);

server.registerTool(
	"create_edge",
	{
		description: "Create a relationship edge between two entities",
		inputSchema: {
			from_type: z
				.string()
				.describe("Source entity type (person/organization/deal)"),
			from_id: z.number().describe("Source entity ID"),
			to_type: z.string().describe("Target entity type"),
			to_id: z.number().describe("Target entity ID"),
			relation: z.string().describe("Relationship type"),
		},
	},
	async ({ from_type, from_id, to_type, to_id, relation }) => {
		const edge = createEdge(db, from_type, from_id, to_type, to_id, relation);
		return {
			content: [{ type: "text", text: `Edge created (id: ${edge.id})` }],
		};
	},
);

server.registerTool(
	"search_all",
	{
		description: "Search across all entities (contacts, deals, orgs, tasks)",
		inputSchema: {
			query: z.string().describe("Search query"),
			type: z
				.string()
				.optional()
				.describe("Filter by type: contact, deal, organization, task"),
		},
	},
	async ({ query, type }) => {
		let { results } = searchAll(db, query);
		if (type) results = results.filter((r) => r.type === type);
		return {
			content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
		};
	},
);

server.registerTool(
	"set_custom_field",
	{
		description: "Set a custom field on a contact, deal, or organization",
		inputSchema: {
			entity_type: z
				.string()
				.describe("Entity type: contact, deal, organization"),
			entity_id: z.number().describe("Entity ID"),
			field_name: z.string().describe("Field name"),
			field_value: z.string().describe("Field value"),
		},
	},
	async ({ entity_type, entity_id, field_name, field_value }) => {
		const field = setField(db, entity_type, entity_id, field_name, field_value);
		return {
			content: [
				{
					type: "text",
					text: `Set "${field_name}" = "${field_value}" on ${entity_type} ${entity_id}`,
				},
			],
		};
	},
);

server.registerTool(
	"get_custom_fields",
	{
		description: "Get custom fields for a contact, deal, or organization",
		inputSchema: {
			entity_type: z
				.string()
				.describe("Entity type: contact, deal, organization"),
			entity_id: z.number().describe("Entity ID"),
		},
	},
	async ({ entity_type, entity_id }) => {
		const fields = getFields(db, entity_type, entity_id);
		return {
			content: [{ type: "text", text: JSON.stringify(fields, null, 2) }],
		};
	},
);

server.registerTool(
	"check_inbox",
	{
		description: "Get recent inbound emails, optionally filtered by contact",
		inputSchema: {
			contact_id: z.number().optional().describe("Filter by contact ID"),
			limit: z
				.number()
				.optional()
				.describe("Max emails to return (default 20)"),
		},
	},
	async ({ contact_id, limit }) => {
		const rows = listInteractions(db, {
			contactId: contact_id,
			type: "email",
		})
			.filter((r) => r.direction === "inbound")
			.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
			.slice(0, limit ?? 20);
		return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
	},
);

server.registerTool(
	"get_email_thread",
	{
		description:
			"Get full email conversation (inbound + outbound) for a contact",
		inputSchema: {
			contact_id: z.number().describe("Contact ID"),
			limit: z
				.number()
				.optional()
				.describe("Max emails to return (default 20)"),
		},
	},
	async ({ contact_id, limit }) => {
		const rows = listInteractions(db, {
			contactId: contact_id,
			type: "email",
		})
			.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
			.slice(-(limit ?? 20));
		return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
	},
);

// ── New tools ───────────────────────────────────────────────────

server.registerTool(
	"list_tasks",
	{
		description:
			"List open tasks with optional filters (due today, overdue, by contact/deal)",
		inputSchema: {
			due_today: z.boolean().optional().describe("Only show tasks due today"),
			overdue: z.boolean().optional().describe("Only show overdue tasks"),
			contact_id: z.number().optional().describe("Filter by contact ID"),
			deal_id: z.number().optional().describe("Filter by deal ID"),
		},
	},
	async ({ due_today, overdue, contact_id, deal_id }) => {
		const tasks = listTasks(db, {
			dueToday: due_today,
			overdue,
			contactId: contact_id,
			dealId: deal_id,
		});
		return {
			content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
		};
	},
);

server.registerTool(
	"get_deal_detail",
	{
		description:
			"Get full deal details including contact, interactions, and tasks",
		inputSchema: {
			deal_id: z.number().describe("Deal ID"),
		},
	},
	async ({ deal_id }) => {
		const deal = db
			.select()
			.from(schema.deals)
			.where(eq(schema.deals.id, deal_id))
			.get();
		if (!deal) return { content: [{ type: "text", text: "Deal not found" }] };

		const contact = deal.contact_id ? showContact(db, deal.contact_id) : null;
		const interactions = listInteractions(db, { dealId: deal_id });
		const tasks = listTasks(db, { dealId: deal_id });

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({ deal, contact, interactions, tasks }, null, 2),
				},
			],
		};
	},
);

server.registerTool(
	"get_timeline",
	{
		description: "Get recent activity feed (interactions, tasks, deals)",
		inputSchema: {
			last_days: z
				.number()
				.optional()
				.describe("Number of days to look back (default 30)"),
			type: z
				.string()
				.optional()
				.describe(
					"Filter by type: interaction, task_completed, deal_created, deal_closed",
				),
			contact_id: z.number().optional().describe("Filter by contact ID"),
			limit: z
				.number()
				.optional()
				.describe("Max events to return (default 50)"),
		},
	},
	async ({ last_days, type, contact_id, limit }) => {
		const events = getTimeline(db, {
			lastDays: last_days,
			type,
			contactId: contact_id,
			limit,
		});
		return {
			content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
		};
	},
);

server.registerTool(
	"get_dashboard",
	{
		description:
			"Get pipeline health summary: deal stages, overdue tasks, stale contacts, pending actions",
		inputSchema: {},
	},
	async () => {
		const data = getDashboard(db);
		return {
			content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
		};
	},
);

server.registerTool(
	"recall_memory",
	{
		description:
			"Query past agent proposals and their outcomes (approved/rejected). Use before proposing to avoid repeating rejected actions.",
		inputSchema: {
			agent_name: z
				.string()
				.optional()
				.describe("Filter by agent name (defaults to current agent)"),
			contact_id: z.number().optional().describe("Filter by contact ID"),
			deal_id: z.number().optional().describe("Filter by deal ID"),
			outcome: z
				.string()
				.optional()
				.describe("Filter by outcome: pending, approved, rejected"),
			limit: z
				.number()
				.optional()
				.describe("Max memories to return (default 20)"),
		},
	},
	async ({
		agent_name: queryAgentName,
		contact_id,
		deal_id,
		outcome,
		limit,
	}) => {
		let rows = db.select().from(schema.agentMemory).all();

		const filterAgent = queryAgentName || agentName;
		if (filterAgent) {
			rows = rows.filter((r) => r.agent_name === filterAgent);
		}
		if (contact_id) {
			rows = rows.filter((r) => r.contact_id === contact_id);
		}
		if (deal_id) {
			rows = rows.filter((r) => r.deal_id === deal_id);
		}
		if (outcome) {
			rows = rows.filter((r) => r.outcome === outcome);
		}

		rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
		rows = rows.slice(0, limit ?? 20);

		return {
			content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
		};
	},
);

const transport = new StdioServerTransport();
await server.connect(transport);
