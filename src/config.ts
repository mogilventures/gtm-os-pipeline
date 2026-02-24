import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "smol-toml";

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
		provider: "composio" | "none";
		from: string;
	};
	integrations: {
		composio_api_key: string;
		user_id: string;
		enabled: boolean;
	};
	[key: string]: unknown;
}

const DEFAULT_CONFIG: PipelineConfig = {
	pipeline: {
		stages: [
			"lead",
			"qualified",
			"proposal",
			"negotiation",
			"closed_won",
			"closed_lost",
		],
		currency: "USD",
	},
	agent: {
		model: "claude-sonnet-4-6",
		auto_approve: false,
	},
	email: {
		provider: "none",
		from: "",
	},
	integrations: {
		composio_api_key: "",
		user_id: "pipeline-crm-user",
		enabled: false,
	},
};

export function getPipelineDir(): string {
	return join(homedir(), ".pipeline");
}

export function getConfigPath(): string {
	return join(getPipelineDir(), "config.toml");
}

function getProjectConfigPath(): string {
	return join(process.cwd(), ".pipeline", "config.toml");
}

export function loadConfig(): PipelineConfig {
	const config = structuredClone(DEFAULT_CONFIG);

	// User-level config
	const userPath = getConfigPath();
	if (existsSync(userPath)) {
		const userConfig = parse(readFileSync(userPath, "utf-8"));
		deepMerge(config, userConfig);
	}

	// Project-level config (overrides user)
	const projectPath = getProjectConfigPath();
	if (existsSync(projectPath)) {
		const projectConfig = parse(readFileSync(projectPath, "utf-8"));
		deepMerge(config, projectConfig);
	}

	return config;
}

export function saveConfig(config: PipelineConfig): void {
	const configPath = getConfigPath();
	mkdirSync(getPipelineDir(), { recursive: true });
	writeFileSync(
		configPath,
		stringify(config as Record<string, unknown>),
		"utf-8",
	);
}

export function getDefaultConfig(): PipelineConfig {
	return structuredClone(DEFAULT_CONFIG);
}

export function getConfigValue(config: PipelineConfig, key: string): unknown {
	const parts = key.split(".");
	let current: unknown = config;
	for (const part of parts) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

export function setConfigValue(
	config: PipelineConfig,
	key: string,
	value: string,
): void {
	const parts = key.split(".");
	let current: Record<string, unknown> = config as unknown as Record<
		string,
		unknown
	>;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (current[part] == null || typeof current[part] !== "object") {
			current[part] = {};
		}
		current = current[part] as Record<string, unknown>;
	}

	const lastKey = parts[parts.length - 1];

	// Try to parse as JSON for arrays/booleans/numbers
	try {
		current[lastKey] = JSON.parse(value);
	} catch {
		current[lastKey] = value;
	}
}

function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): void {
	for (const key of Object.keys(source)) {
		if (
			source[key] &&
			typeof source[key] === "object" &&
			!Array.isArray(source[key]) &&
			target[key] &&
			typeof target[key] === "object" &&
			!Array.isArray(target[key])
		) {
			deepMerge(
				target[key] as Record<string, unknown>,
				source[key] as Record<string, unknown>,
			);
		} else {
			target[key] = source[key];
		}
	}
}
