import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";

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
 * @deprecated Email sync via Resend has been removed. The agent reads Gmail
 * directly through Composio. Use `pipeline agent "check my inbox"` instead.
 */
export async function syncInboundEmails(
	_db: PipelineDB,
	_opts?: { limit?: number },
): Promise<SyncResult> {
	throw new Error(
		"Email sync is no longer needed.\n" +
			"Gmail is now read directly via Composio. Run:\n" +
			'  pipeline agent "check my inbox"',
	);
}
