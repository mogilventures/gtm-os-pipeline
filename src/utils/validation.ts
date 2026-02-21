// ── Validation helpers (pure functions, no deps) ────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
	return EMAIL_RE.test(email);
}

/**
 * Accept ISO (2026-03-15) or US (03/15/2026) date strings.
 * Returns YYYY-MM-DD or null if unparseable.
 */
export function parseDate(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	// ISO: YYYY-MM-DD
	const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (isoMatch) {
		const [, y, m, d] = isoMatch;
		const date = new Date(`${y}-${m}-${d}T00:00:00`);
		if (!Number.isNaN(date.getTime())) return `${y}-${m}-${d}`;
	}

	// US: MM/DD/YYYY
	const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (usMatch) {
		const [, m, d, y] = usMatch;
		const mm = m.padStart(2, "0");
		const dd = d.padStart(2, "0");
		const date = new Date(`${y}-${mm}-${dd}T00:00:00`);
		if (!Number.isNaN(date.getTime())) return `${y}-${mm}-${dd}`;
	}

	return null;
}

export function parseBool(raw: string): boolean {
	const lower = raw.toLowerCase().trim();
	return lower === "yes" || lower === "true" || lower === "1";
}

export function stripBom(content: string): string {
	if (content.charCodeAt(0) === 0xfeff) {
		return content.slice(1);
	}
	return content;
}
