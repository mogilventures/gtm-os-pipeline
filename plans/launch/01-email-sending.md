# Spec: Email Sending via Resend

**Priority:** P0 — Blocks the hero demo. Without this, "AI that follows up so you don't forget" is a broken promise.

**Scope:** Wire Resend as the email transport. When a `send_email` pending action is approved, actually send the email and log it as an interaction. Add a manual `pipeline email send` command.

---

## 1. Install Resend SDK

```bash
npm install resend
```

**File:** `package.json`
Add `"resend": "^4.0.0"` to `dependencies`.

---

## 2. Extend Config Schema

**File:** `src/config.ts` (lines 6-16)

Add an `email` section to `PipelineConfig`:

```typescript
interface PipelineConfig {
	pipeline: {
		stages: string[];
		currency: string;
	};
	agent: {
		model: string;
		auto_approve: boolean;
	};
	email: {
		provider: "resend" | "none";
		from: string;
		resend_api_key: string;
	};
	[key: string]: unknown;
}
```

Update `DEFAULT_CONFIG` (line 18-27):

```typescript
const DEFAULT_CONFIG: PipelineConfig = {
	pipeline: {
		stages: ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"],
		currency: "USD",
	},
	agent: {
		model: "claude-sonnet-4-6",
		auto_approve: false,
	},
	email: {
		provider: "none",
		from: "",
		resend_api_key: "",
	},
};
```

This means `config.toml` will look like:

```toml
[pipeline]
stages = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]
currency = "USD"

[agent]
model = "claude-sonnet-4-6"
auto_approve = false

[email]
provider = "resend"
from = "you@yourdomain.com"
resend_api_key = "re_xxxxxxxxxxxx"
```

---

## 3. Create Email Service

**New file:** `src/services/email.ts`

```typescript
import { loadConfig } from "../config.js";

interface SendEmailOptions {
	to: string;
	subject: string;
	body: string;
	replyTo?: string;
}

interface SendEmailResult {
	id: string;
	provider: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
	const config = loadConfig();

	if (config.email.provider === "none" || !config.email.provider) {
		throw new Error(
			"Email not configured. Run `pipeline config:set email.provider resend` and set your API key.\n" +
			"See: https://resend.com/api-keys",
		);
	}

	if (!config.email.from) {
		throw new Error("Email 'from' address not configured. Run `pipeline config:set email.from you@yourdomain.com`");
	}

	if (config.email.provider === "resend") {
		return sendViaResend(opts, config.email);
	}

	throw new Error(`Unknown email provider: ${config.email.provider}`);
}

async function sendViaResend(
	opts: SendEmailOptions,
	emailConfig: { from: string; resend_api_key: string },
): Promise<SendEmailResult> {
	const apiKey = emailConfig.resend_api_key || process.env.RESEND_API_KEY;
	if (!apiKey) {
		throw new Error(
			"Resend API key not configured. Set it via:\n" +
			"  pipeline config:set email.resend_api_key re_xxxxxxxxxxxx\n" +
			"  or: export RESEND_API_KEY=re_xxxxxxxxxxxx",
		);
	}

	const { Resend } = await import("resend");
	const resend = new Resend(apiKey);

	const { data, error } = await resend.emails.send({
		from: emailConfig.from,
		to: [opts.to],
		subject: opts.subject,
		text: opts.body,
		...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
	});

	if (error) {
		throw new Error(`Resend error: ${error.message}`);
	}

	return { id: data!.id, provider: "resend" };
}

export function isEmailConfigured(): boolean {
	try {
		const config = loadConfig();
		return config.email.provider !== "none" && !!config.email.from;
	} catch {
		return false;
	}
}
```

---

## 4. Wire Email Sending into Approval

**File:** `src/services/approval.ts` (lines 27-39)

Replace the `send_email` case:

```typescript
case "send_email": {
	const to = payload.to as string;
	const subject = (payload.subject as string) || "(no subject)";
	const body = (payload.body as string) || "";

	// Resolve contact_id for interaction logging
	const contactId = payload.contact_id as number | undefined;

	try {
		const { sendEmail } = await import("./email.js");
		const emailResult = await sendEmail({ to, subject, body });

		// Log as a real outbound email interaction
		db.insert(schema.interactions)
			.values({
				contact_id: contactId,
				deal_id: payload.deal_id as number | undefined,
				type: "email",
				direction: "outbound",
				subject,
				body,
			})
			.run();

		// Update contact's updated_at if we have a contact_id
		if (contactId) {
			db.update(schema.contacts)
				.set({ updated_at: new Date().toISOString() })
				.where(eq(schema.contacts.id, contactId))
				.run();
		}

		result = `Email sent via ${emailResult.provider} (${emailResult.id}): to=${to}, subject=${subject}`;
	} catch (error) {
		// Fall back to logging if email not configured
		const errMsg = error instanceof Error ? error.message : String(error);
		db.insert(schema.interactions)
			.values({
				contact_id: contactId,
				type: "note",
				body: `[Email draft — sending failed] To: ${to}, Subject: ${subject}\n\n${body}\n\nError: ${errMsg}`,
			})
			.run();
		result = `Email sending failed (logged as draft): ${errMsg}`;
	}
	break;
}
```

**Important:** The `approveAction` function must become `async` since `sendEmail` is async.

Change signature at line 14:
```typescript
// Before
export function approveAction(db: PipelineDB, actionId: number): string {
// After
export async function approveAction(db: PipelineDB, actionId: number): Promise<string> {
```

This cascades to callers:

**File:** `src/services/approval.ts` line 118 (`approveAll`):
```typescript
// Before
export function approveAll(db: PipelineDB): string[] {
// After
export async function approveAll(db: PipelineDB): Promise<string[]> {
	const pending = listPendingActions(db);
	const results: string[] = [];
	for (const action of pending) {
		const result = await approveAction(db, action.id);
		results.push(`#${action.id}: ${result}`);
	}
	return results;
}
```

**File:** `src/commands/approve.ts` lines 69-73 and 101-102:
```typescript
// Line 69 — approveAll is now async
const results = await approveAll(db);

// Line 101 — approveAction is now async
const result = await approveAction(db, action.id);
```

---

## 5. Add `pipeline email send` Command

**New file:** `src/commands/email/send.ts`

```typescript
import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { sendEmail } from "../../services/email.js";
import { logInteraction } from "../../services/interactions.js";
import { getContactsForFuzzy } from "../../services/contacts.js";
import { fuzzySearch } from "../../utils/search.js";

export default class EmailSend extends BaseCommand {
	static override description = "Send an email to a contact";

	static override examples = [
		'<%= config.bin %> email:send jane --subject "Quick follow-up" --body "Hey Jane, wanted to check in..."',
	];

	static override args = {
		contact: Args.string({ description: "Contact name (fuzzy matched)", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		subject: Flags.string({ description: "Email subject", required: true }),
		body: Flags.string({ description: "Email body", required: true }),
		deal: Flags.string({ description: "Associate with a deal" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(EmailSend);
		const db = getDb(flags.db);

		// Resolve contact
		const contacts = getContactsForFuzzy(db);
		const match = fuzzySearch(contacts, args.contact, ["name", "email"]);
		if (!match) {
			this.error(`No contact found matching "${args.contact}"`);
		}

		if (!match.email) {
			this.error(`Contact "${match.name}" has no email address`);
		}

		// Send
		const result = await sendEmail({
			to: match.email,
			subject: flags.subject,
			body: flags.body,
		});

		// Log interaction
		logInteraction(db, {
			contact_id: match.contactId,
			type: "email",
			direction: "outbound",
			subject: flags.subject,
			body: flags.body,
		});

		this.log(`Email sent to ${match.name} <${match.email}> via ${result.provider}`);
		this.log(`Subject: ${flags.subject}`);

		if (flags.json) {
			this.log(JSON.stringify({ sent: true, to: match.email, id: result.id }));
		}
	}
}
```

---

## 6. Update Subagent Prompt for Better Email Proposals

**File:** `src/services/subagents.ts` (lines 15-21)

Replace the `follow-up` agent prompt to include richer payload in `propose_action`:

```typescript
prompt: `You are a follow-up specialist. Your job is to:
1. Use get_stale_contacts to find contacts who haven't been contacted recently (default: 14 days)
2. For each stale contact, use get_contact_with_history to understand the relationship
3. Propose follow-up actions using propose_action with action_type "send_email"

When proposing emails via propose_action, the payload JSON MUST include:
- "to": the contact's email address
- "subject": a specific, personalized email subject line
- "body": the full email body text, written in a natural, professional tone
- "contact_id": the contact's ID (so the email gets linked to their record)

Example payload:
{"to":"jane@acme.co","subject":"Quick check-in on Q2 timeline","body":"Hi Jane,\\n\\nWanted to follow up on our conversation about the Q2 timeline...","contact_id":5}

Be specific about why each follow-up is needed. Write real email drafts, not summaries.
Keep emails concise (3-5 sentences). Match a founder's casual-professional tone.`,
```

---

## 7. Testing

### Unit Tests for Email Service

**New file:** `test/commands/email.test.ts`

```typescript
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("email", () => {
	let tmpDir: string;
	let dbFlag: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		const dbPath = join(tmpDir, "test.db");
		dbFlag = `--db ${dbPath}`;
		runPipeline(`init ${dbFlag}`);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("email:send fails without email configured", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@test.co ${dbFlag}`);
		expect(() =>
			runPipeline(`email:send jane --subject "Test" --body "Hello" ${dbFlag}`)
		).toThrow(/[Ee]mail not configured/);
	});

	it("email:send fails when contact has no email", () => {
		runPipeline(`contact:add "No Email Person" ${dbFlag}`);
		// Configure email to isolate the error
		runPipeline(`config:set email.provider resend ${dbFlag}`);
		runPipeline(`config:set email.from test@example.com ${dbFlag}`);
		expect(() =>
			runPipeline(`email:send "No Email" --subject "Test" --body "Hello" ${dbFlag}`)
		).toThrow(/no email address/);
	});

	it("email:send command appears in help", () => {
		const output = runPipeline("email:send --help");
		expect(output).toContain("Send an email to a contact");
	});
});
```

### Updated Approval Tests

**File:** `test/commands/approval.test.ts`

Add this test case after the existing tests:

```typescript
it("approve send_email logs interaction even when sending fails", () => {
	const actionId = insertPendingAction(
		dbPath,
		"send_email",
		{ to: "jane@acme.co", subject: "Follow up", body: "Hi Jane", contact_id: 1 },
		"Stale contact",
	);

	// Email not configured, so sending will fail but should log as draft
	const output = runPipeline(`approve --all ${dbFlag}`);
	expect(output).toContain("Email sending failed");
	expect(output).toContain("logged as draft");
});
```

### Manual Integration Test (with real Resend key)

```bash
# 1. Set up
export RESEND_API_KEY=re_your_test_key
pipeline config:set email.provider resend
pipeline config:set email.from "onboarding@resend.dev"  # Resend test sender

# 2. Add a contact
pipeline contact:add "Test User" --email delivered@resend.dev

# 3. Manual send
pipeline email:send "Test User" --subject "Pipeline test" --body "Testing email integration"
# Expected: "Email sent to Test User <delivered@resend.dev> via resend"

# 4. Agent flow
pipeline agent:follow-up --days 0
# Expected: agent proposes send_email actions

pipeline approve --list
# Expected: pending actions with email payloads

pipeline approve --all
# Expected: "Email sent via resend (re_xxxxx)"

# 5. Verify interaction logged
pipeline log:list --type email
# Expected: outbound email interaction for the contact
```

---

## 8. Migration Concerns

None. No schema changes. The `pending_actions` table already stores `send_email` payloads with `to`, `subject`, `body` fields. The only change is what happens when the action is approved.

## 9. Error Handling

| Scenario | Behavior |
|---|---|
| Email not configured (`provider: "none"`) | Throw with setup instructions |
| Resend API key missing | Throw with instructions for config or env var |
| Resend API returns error (bad email, rate limit) | Catch, log as draft note, include error in output |
| Contact has no email address | Throw before attempting send |
| Network failure | Caught by Resend SDK, surfaced as error, logged as draft |

## 10. Files Changed Summary

| File | Change |
|---|---|
| `package.json` | Add `resend` dependency |
| `src/config.ts` | Add `email` section to config interface and defaults |
| `src/services/email.ts` | **New** — email sending via Resend |
| `src/services/approval.ts` | Wire real sending in `send_email` case, make `approveAction`/`approveAll` async |
| `src/commands/approve.ts` | Await async `approveAction`/`approveAll` calls |
| `src/commands/email/send.ts` | **New** — `pipeline email:send` command |
| `src/services/subagents.ts` | Update follow-up agent prompt for richer email payloads |
| `test/commands/email.test.ts` | **New** — email command tests |
| `test/commands/approval.test.ts` | Add email-specific approval test |
