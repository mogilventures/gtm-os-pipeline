import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { fetchInboundEmailDetail, fetchInboundEmails } from "./email.js";
import { emitEvent } from "./events.js";

interface SyncResult {
	synced: number;
	skipped: number;
	unmatched: string[];
}

/**
 * Resolve a contact_id from a sender email address.
 * Matches against people.email, then joins to contacts.
 * Extracts bare email from "Name <email>" format if needed.
 */
export function resolveContactByEmail(
	db: PipelineDB,
	senderEmail: string,
): number | null {
	// Extract bare email from "Name <email>" format
	const match = senderEmail.match(/<([^>]+)>/);
	const email = match ? match[1] : senderEmail.trim();

	const person = db
		.select({ id: schema.people.id })
		.from(schema.people)
		.where(eq(schema.people.email, email))
		.get();

	if (!person) return null;

	const contact = db
		.select({ id: schema.contacts.id })
		.from(schema.contacts)
		.where(eq(schema.contacts.person_id, person.id))
		.get();

	return contact?.id ?? null;
}

/**
 * Sync inbound emails from Resend into the local interactions table.
 * Deduplicates by message_id, resolves senders to contacts.
 */
export async function syncInboundEmails(
	db: PipelineDB,
	opts?: { limit?: number },
): Promise<SyncResult> {
	const result: SyncResult = { synced: 0, skipped: 0, unmatched: [] };

	const { data: emails } = await fetchInboundEmails({
		limit: opts?.limit ?? 50,
	});

	for (const email of emails) {
		// Check if message_id already exists (dedup)
		const existing = db
			.select({ id: schema.interactions.id })
			.from(schema.interactions)
			.where(eq(schema.interactions.message_id, email.id))
			.get();

		if (existing) {
			result.skipped++;
			continue;
		}

		// Fetch full email detail for body
		const detail = await fetchInboundEmailDetail(email.id);

		// Resolve sender to contact
		const contactId = resolveContactByEmail(db, email.from);

		if (!contactId) {
			// Extract bare email for unmatched tracking
			const addrMatch = email.from.match(/<([^>]+)>/);
			const bareEmail = addrMatch ? addrMatch[1] : email.from;
			if (!result.unmatched.includes(bareEmail)) {
				result.unmatched.push(bareEmail);
			}
		}

		// Insert as interaction
		const interaction = db
			.insert(schema.interactions)
			.values({
				contact_id: contactId,
				type: "email",
				direction: "inbound",
				subject: email.subject,
				body: detail.text || detail.html || "",
				message_id: email.id,
				from_address: email.from,
				occurred_at: email.created_at || new Date().toISOString(),
			})
			.returning()
			.get();

		emitEvent(db, "email_received", "interaction", interaction.id, {
			from: email.from,
			subject: email.subject,
			contact_id: contactId,
		});

		// Touch contact's updated_at if matched
		if (contactId) {
			db.update(schema.contacts)
				.set({ updated_at: new Date().toISOString() })
				.where(eq(schema.contacts.id, contactId))
				.run();
		}

		result.synced++;
	}

	return result;
}
