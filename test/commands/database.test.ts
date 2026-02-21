import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb, resetDb, schema } from "../../src/db/index.js";
import { cleanupTmpDir, createTmpDir } from "../helpers.js";

describe("database", () => {
	let tmpDir: string;
	let dbPath: string;

	beforeEach(() => {
		resetDb();
		tmpDir = createTmpDir();
		dbPath = join(tmpDir, "test.db");
	});

	afterEach(() => {
		closeDb();
		cleanupTmpDir(tmpDir);
	});

	it("creates database and all tables", () => {
		const db = getDb(dbPath);
		expect(db).toBeDefined();
	});

	it("inserts and queries people", () => {
		const db = getDb(dbPath);
		db.insert(schema.people)
			.values({ name: "Jane Smith", email: "jane@acme.co" })
			.run();
		const rows = db.select().from(schema.people).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].name).toBe("Jane Smith");
		expect(rows[0].email).toBe("jane@acme.co");
	});

	it("inserts and queries organizations", () => {
		const db = getDb(dbPath);
		db.insert(schema.organizations)
			.values({ name: "Acme Corp", domain: "acme.co", industry: "Tech" })
			.run();
		const rows = db.select().from(schema.organizations).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].name).toBe("Acme Corp");
	});

	it("inserts contacts with FK relationships", () => {
		const db = getDb(dbPath);
		const person = db
			.insert(schema.people)
			.values({ name: "Jane Smith", email: "jane@acme.co" })
			.returning()
			.get();
		const org = db
			.insert(schema.organizations)
			.values({ name: "Acme Corp" })
			.returning()
			.get();
		db.insert(schema.contacts)
			.values({
				person_id: person.id,
				org_id: org.id,
				role: "CTO",
				warmth: "warm",
			})
			.run();
		const rows = db.select().from(schema.contacts).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].person_id).toBe(person.id);
		expect(rows[0].org_id).toBe(org.id);
	});

	it("inserts deals", () => {
		const db = getDb(dbPath);
		db.insert(schema.deals)
			.values({ title: "Big Deal", value: 50000, stage: "proposal" })
			.run();
		const rows = db.select().from(schema.deals).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("Big Deal");
		expect(rows[0].value).toBe(50000);
	});

	it("inserts interactions", () => {
		const db = getDb(dbPath);
		db.insert(schema.interactions)
			.values({ type: "email", direction: "outbound", subject: "Hello" })
			.run();
		const rows = db.select().from(schema.interactions).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].type).toBe("email");
	});

	it("inserts tasks", () => {
		const db = getDb(dbPath);
		db.insert(schema.tasks)
			.values({ title: "Follow up", due: "2026-02-20" })
			.run();
		const rows = db.select().from(schema.tasks).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("Follow up");
	});

	it("inserts pending actions", () => {
		const db = getDb(dbPath);
		db.insert(schema.pendingActions)
			.values({
				action_type: "send_email",
				payload: { to: "jane@acme.co", body: "Hi" },
				reasoning: "Follow up needed",
			})
			.run();
		const rows = db.select().from(schema.pendingActions).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].action_type).toBe("send_email");
	});

	it("inserts edges with indexes", () => {
		const db = getDb(dbPath);
		db.insert(schema.edges)
			.values({
				from_type: "person",
				from_id: 1,
				to_type: "organization",
				to_id: 1,
				relation: "works_at",
			})
			.run();
		const rows = db
			.select()
			.from(schema.edges)
			.where(eq(schema.edges.relation, "works_at"))
			.all();
		expect(rows).toHaveLength(1);
	});

	it("enforces unique email on people", () => {
		const db = getDb(dbPath);
		db.insert(schema.people)
			.values({ name: "Jane", email: "jane@acme.co" })
			.run();
		expect(() => {
			db.insert(schema.people)
				.values({ name: "Other Jane", email: "jane@acme.co" })
				.run();
		}).toThrow();
	});

	it("enforces unique org name", () => {
		const db = getDb(dbPath);
		db.insert(schema.organizations).values({ name: "Acme Corp" }).run();
		expect(() => {
			db.insert(schema.organizations).values({ name: "Acme Corp" }).run();
		}).toThrow();
	});
});
