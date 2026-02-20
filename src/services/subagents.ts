import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface AgentDefinition {
	name: string;
	description: string;
	prompt: string;
}

const BUILTIN_AGENTS: AgentDefinition[] = [
	{
		name: "follow-up",
		description: "Check stale contacts and propose follow-up emails",
		prompt: `You are a follow-up specialist. Your job is to:
1. Use get_stale_contacts to find contacts who haven't been contacted recently (default: 14 days)
2. For each stale contact, use get_contact_with_history to understand the relationship
3. Propose follow-up actions using propose_action with action_type "send_email"
4. Include personalized reasoning based on their history

Be specific about why each follow-up is needed and suggest a brief email subject/body.`,
	},
	{
		name: "enrich",
		description: "Research a contact and update their records",
		prompt: `You are a contact enrichment specialist. Your job is to:
1. Use search_contacts to find the specified contact
2. Use get_contact_with_history to see what information we have
3. Identify gaps in their profile (missing company info, role, social links)
4. Use update_contact or update_person to fill in any information the user provides
5. Suggest what additional information would be valuable

Report what you found and what was updated.`,
	},
	{
		name: "digest",
		description: "Morning pipeline briefing and daily digest",
		prompt: `You are a CRM digest specialist. Create a morning briefing by:
1. Use list_deals to see all active deals — summarize by stage with total values
2. Use get_stale_contacts with days=7 to find contacts needing attention
3. Check for any deals in late stages (proposal, negotiation) that need action
4. Provide a prioritized action list for today

Format as a clean, scannable briefing with sections: Pipeline Summary, Urgent Actions, Follow-ups Needed.`,
	},
	{
		name: "qualify",
		description: "Assess deal health and qualification",
		prompt: `You are a deal qualification specialist. For the specified deal:
1. Use list_deals to find the deal
2. Use get_related to understand all connected entities
3. Assess deal health based on: activity recency, contact warmth, deal value vs stage, time in current stage
4. Provide a qualification score (1-10) with reasoning
5. Suggest next actions to advance the deal

Be honest about deal risks and opportunities.`,
	},
];

export function getBuiltinAgents(): AgentDefinition[] {
	return BUILTIN_AGENTS;
}

export function getCustomAgents(): AgentDefinition[] {
	const agentsDir = join(homedir(), ".pipeline", "agents");
	if (!existsSync(agentsDir)) return [];

	const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
	return files.map((f) => {
		const name = f.replace(/\.md$/, "");
		const content = readFileSync(join(agentsDir, f), "utf-8");
		// First line as description, rest as prompt
		const lines = content.split("\n");
		const description = lines[0].replace(/^#\s*/, "").trim();
		const prompt = lines.slice(1).join("\n").trim();
		return { name, description, prompt };
	});
}

function getAllAgents(): AgentDefinition[] {
	return [...getBuiltinAgents(), ...getCustomAgents()];
}

export function getAgent(name: string): AgentDefinition | undefined {
	return getAllAgents().find((a) => a.name === name);
}
