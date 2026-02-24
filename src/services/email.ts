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
			"Email not configured. Run:\n" +
				"  pipeline config:set email.provider composio",
		);
	}

	if (config.email.provider === "composio") {
		return sendViaComposio(opts);
	}

	throw new Error(`Unknown email provider: ${config.email.provider}`);
}

async function sendViaComposio(
	opts: SendEmailOptions,
): Promise<SendEmailResult> {
	const { Composio } = await import("@composio/core");
	const { loadConfig: loadCfg } = await import("../config.js");
	const cfg = loadCfg();
	const apiKey =
		(cfg.integrations?.composio_api_key as string) ||
		process.env.COMPOSIO_API_KEY;
	if (!apiKey) {
		throw new Error(
			"Composio API key not configured. Run: pipeline config:set integrations.composio_api_key <key>",
		);
	}
	const composio = new Composio({ apiKey });
	const userId =
		(cfg.integrations?.user_id as string) || "pipeline-crm-user";

	const result = await composio.tools.execute("GMAIL_SEND_EMAIL", {
		userId,
		arguments: {
			recipient_email: opts.to,
			subject: opts.subject,
			body: opts.body,
			...(opts.replyTo ? { in_reply_to: opts.replyTo } : {}),
		},
		dangerouslySkipVersionCheck: true,
	});

	const resultData = result.data as Record<string, unknown> | undefined;
	const messageId =
		(resultData?.id as string) ||
		(resultData?.messageId as string) ||
		`composio-${Date.now()}`;

	return { id: messageId, provider: "composio/gmail" };
}

export function isEmailConfigured(): boolean {
	try {
		const config = loadConfig();
		return config.email.provider === "composio";
	} catch {
		return false;
	}
}
