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

export async function sendEmail(
	opts: SendEmailOptions,
): Promise<SendEmailResult> {
	const config = loadConfig();

	if (config.email.provider === "none" || !config.email.provider) {
		throw new Error(
			"Email not configured. Run `pipeline config:set email.provider resend` and set your API key.\n" +
				"See: https://resend.com/api-keys",
		);
	}

	if (!config.email.from) {
		throw new Error(
			"Email 'from' address not configured. Run `pipeline config:set email.from you@yourdomain.com`",
		);
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

interface InboundEmail {
	id: string;
	from: string;
	to: string[];
	subject: string;
	created_at: string;
}

interface InboundEmailDetail extends InboundEmail {
	text?: string;
	html?: string;
}

interface FetchInboundResult {
	data: InboundEmail[];
	has_more: boolean;
}

function getResendApiKey(): string {
	const config = loadConfig();
	const apiKey = config.email.resend_api_key || process.env.RESEND_API_KEY;
	if (!apiKey) {
		throw new Error("Resend API key not configured.");
	}
	return apiKey;
}

export async function fetchInboundEmails(opts?: {
	limit?: number;
}): Promise<FetchInboundResult> {
	const apiKey = getResendApiKey();
	const limit = opts?.limit ?? 50;

	const res = await fetch(`https://api.resend.com/emails?limit=${limit}`, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!res.ok) {
		throw new Error(`Resend API error (${res.status}): ${await res.text()}`);
	}

	const body = (await res.json()) as {
		data: InboundEmail[];
		has_more?: boolean;
	};
	return {
		data: body.data ?? [],
		has_more: body.has_more ?? false,
	};
}

export async function fetchInboundEmailDetail(
	id: string,
): Promise<InboundEmailDetail> {
	const apiKey = getResendApiKey();

	const res = await fetch(`https://api.resend.com/emails/${id}`, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!res.ok) {
		throw new Error(`Resend API error (${res.status}): ${await res.text()}`);
	}

	return (await res.json()) as InboundEmailDetail;
}
