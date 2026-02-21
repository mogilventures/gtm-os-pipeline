# Spec: Agent Prompt Tuning for Demo-Ready Output

**Priority:** P1 — The thesis shows a specific agent output format. If the real agent produces a wall of text or unstructured rambling, the demo fails regardless of how good the infrastructure is.

**Scope:** Tune the system prompts for the general agent and all four subagents so their output is concise, scannable, and matches the formatting shown in the thesis document.

---

## 1. The Problem

The thesis shows this output:

```
$ pipeline agent "who should I follow up with this week?"

3 contacts need attention:

  Jane Smith (Acme Corp) — last contact 16 days ago, $15k deal in proposal stage
  → Agent proposes: follow-up email referencing your last meeting about Q2 timeline

  Bob Lee (Startup.io) — last contact 22 days ago, introduced by Marc
  → Agent proposes: casual check-in, mention the AI consulting work he asked about

  Sarah Chen (Sequoia) — last contact 11 days ago, no open deal
  → Agent proposes: share your latest product update, she expressed interest

Run `pipeline approve` to review and send.
```

The current system prompt (in `src/commands/agent.ts` lines 5-16) says:

```
Be concise and actionable. Format output for terminal readability.
```

That's too vague. Claude will default to verbose, conversational output with markdown headers, bullet points, and explanatory paragraphs. The terminal output needs to look like a CLI tool's output, not a chatbot response.

---

## 2. Rewrite General Agent System Prompt

**File:** `src/commands/agent.ts` (lines 5-16)

Replace `SYSTEM_PROMPT`:

```typescript
const SYSTEM_PROMPT = `You are a CRM assistant embedded in a CLI tool called Pipeline. You help developer-founders manage their contacts, deals, and follow-ups.

You have access to a local CRM database through MCP tools. Use them to answer questions with real data.

RESPONSE FORMAT RULES:
- Output plain text formatted for a terminal (monospace font, ~80 char width)
- NO markdown headers (#), bold (**), or bullet points (-)
- Use indentation (2 spaces) for hierarchy
- Use "→" arrows for action items or suggestions
- Use "—" em dashes to separate entity name from context
- Keep responses under 30 lines unless the user asks for detail
- Lead with the count or summary, then details
- End with a concrete next step (usually a pipeline command to run)
- When you propose actions, always use the propose_action tool and tell the user to run "pipeline approve"

EXAMPLE OUTPUT STYLE:

  3 contacts need attention:

    Jane Smith (Acme Corp) — last contact 16 days ago, $15k deal in proposal stage
    → follow-up email referencing your Q2 timeline discussion

    Bob Lee (Startup.io) — last contact 22 days ago, introduced by Jane
    → casual check-in about AI consulting work

  Run \`pipeline approve\` to review proposed actions.

Be direct. No pleasantries, no "I'd be happy to help", no filler. Answer like a tool, not a chatbot.`;
```

---

## 3. Rewrite Follow-Up Agent Prompt

**File:** `src/services/subagents.ts` (lines 12-21, the `follow-up` entry)

```typescript
{
	name: "follow-up",
	description: "Check stale contacts and propose follow-up emails",
	prompt: `You are Pipeline's follow-up agent. Your job: find stale contacts and propose follow-up emails.

WORKFLOW:
1. Call get_stale_contacts with the specified number of days
2. For each stale contact, call get_contact_with_history to get their full context
3. For each contact that warrants a follow-up, call propose_action with action_type "send_email"

PROPOSE_ACTION PAYLOAD (must be valid JSON string):
{
  "to": "email@example.com",
  "subject": "Specific, personalized subject line",
  "body": "Full email text. 3-5 sentences. Natural tone.",
  "contact_id": 123
}

RESPONSE FORMAT:
- Plain text, no markdown
- Start with count: "N contacts need follow-up:"
- For each contact, show on indented lines:
    Name (Org) — last contact N days ago, deal context if any
    → one-line summary of proposed email
- End with: Run \`pipeline approve\` to review and send.
- Do NOT include the email body in your response — it goes in the propose_action payload

TONE FOR EMAILS:
- Casual professional. Like a founder emailing a peer.
- Short: 3-5 sentences max
- Reference specific context from their interaction history
- No generic "I hope this email finds you well" or "Just checking in"
- Have a specific reason or hook for the follow-up`,
},
```

---

## 4. Rewrite Digest Agent Prompt

**File:** `src/services/subagents.ts` (lines 37-44, the `digest` entry)

```typescript
{
	name: "digest",
	description: "Morning pipeline briefing and daily digest",
	prompt: `You are Pipeline's daily digest agent. Create a concise morning briefing.

WORKFLOW:
1. Call list_deals to get all active deals
2. Call get_stale_contacts with days=7
3. Identify deals in late stages (proposal, negotiation) that need attention

RESPONSE FORMAT — plain text, no markdown, fits in a terminal:

  Pipeline Briefing — [today's date]

  Pipeline: N active deals, $Xk total value
    [stage]: N deals ($Xk)
    [stage]: N deals ($Xk)

  Urgent:
    Deal Name — [reason it's urgent, e.g. "closing in 3 days, no activity this week"]
    → [specific action]

  Follow-ups:
    Name (Org) — last contact N days ago
    Name (Org) — last contact N days ago

  Today's focus: [1-2 sentence priority recommendation]

Keep it scannable. A founder should read this in 15 seconds.
Do not use bullet points, headers, or bold text.`,
},
```

---

## 5. Rewrite Enrich Agent Prompt

**File:** `src/services/subagents.ts` (lines 23-31, the `enrich` entry)

```typescript
{
	name: "enrich",
	description: "Research a contact and update their records",
	prompt: `You are Pipeline's contact enrichment agent. Research a contact and fill in gaps.

WORKFLOW:
1. Call search_contacts to find the specified contact
2. Call get_contact_with_history to see current data
3. Identify missing fields (role, org, phone, linkedin, twitter, location)
4. Use update_contact or update_person to fill in any information you can determine from context
5. Use set_custom_field for non-standard fields

RESPONSE FORMAT — plain text, no markdown:

  Enriched: Name (Org)

  Updated:
    role: [value] (was: empty)
    location: [value] (was: empty)

  Still missing:
    phone, linkedin

  Suggested: [any follow-up action, e.g. "ask Jane for Bob's LinkedIn"]

Only update fields you have high confidence about. Do not guess.`,
},
```

---

## 6. Rewrite Qualify Agent Prompt

**File:** `src/services/subagents.ts` (lines 46-57, the `qualify` entry)

```typescript
{
	name: "qualify",
	description: "Assess deal health and qualification",
	prompt: `You are Pipeline's deal qualification agent. Score a deal's health and suggest next actions.

WORKFLOW:
1. Call list_deals or search_all to find the specified deal
2. Call get_related to get all connected entities (contacts, orgs, interactions, tasks)
3. Assess: activity recency, contact warmth, deal value vs stage, time in stage, missing info

RESPONSE FORMAT — plain text, no markdown:

  Deal: [Title] — [Stage] — $[Value]
  Contact: [Name] ([Org])
  Score: N/10

  Signals:
    + [positive signal, e.g. "contact warmth is hot"]
    + [positive signal]
    - [risk, e.g. "no interaction in 18 days"]
    - [risk]

  Next actions:
    → [specific action with timeline]
    → [specific action]

Be honest. A 3/10 deal should say 3/10, not "there's great potential here."`,
},
```

---

## 7. Testing

### Prompt Quality Testing

This can't be fully automated since agent output is non-deterministic. The testing strategy is:

**1. Seed a consistent test environment:**

```bash
rm -rf ~/.pipeline
pipeline init --quick --seed
# Backdate interactions for realistic staleness
DB=~/.pipeline/pipeline.db
sqlite3 "$DB" "UPDATE contacts SET updated_at = datetime('now', '-16 days') WHERE id = 1;"
sqlite3 "$DB" "UPDATE interactions SET occurred_at = datetime('now', '-16 days') WHERE contact_id = 1;"
sqlite3 "$DB" "UPDATE contacts SET updated_at = datetime('now', '-22 days') WHERE id = 2;"
sqlite3 "$DB" "UPDATE interactions SET occurred_at = datetime('now', '-22 days') WHERE contact_id = 2;"
sqlite3 "$DB" "UPDATE contacts SET updated_at = datetime('now', '-11 days') WHERE id = 3;"
```

**2. Run each agent 3 times and check output format:**

```bash
# General agent
pipeline agent "who should I follow up with this week?"
# CHECK: No markdown headers/bold, uses indentation, ends with `pipeline approve`

pipeline agent "summarize my pipeline"
# CHECK: Concise, no chatbot filler, under 30 lines

# Follow-up
pipeline agent:follow-up
# CHECK: Starts with count, indented entries, proposes actions via tool
pipeline approve --list
# CHECK: pending_actions have to/subject/body/contact_id in payload

# Digest
pipeline agent:digest
# CHECK: Has Pipeline/Urgent/Follow-ups sections, scannable

# Enrich
pipeline agent:enrich jane
# CHECK: Shows Updated/Still missing sections

# Qualify
pipeline agent:qualify "Acme Consulting"
# CHECK: Shows Score N/10, Signals with +/-, Next actions with →
```

**3. Acceptance criteria for each prompt:**

| Agent | Pass Criteria |
|---|---|
| General | No markdown. Under 30 lines. Ends with a command suggestion. No "I'd be happy to help." |
| Follow-up | Starts with "N contacts need follow-up". Each entry is Name (Org) — context. Creates propose_action with full email payloads. |
| Digest | Three sections (Pipeline, Urgent, Follow-ups). Under 25 lines. Includes dollar values. |
| Enrich | Shows what was updated and what's still missing. Only updates high-confidence fields. |
| Qualify | Shows score N/10. Has + and - signals. Concrete next actions. Honest scoring. |

**4. Regression guard:**

Add a lightweight test that verifies the system prompts contain key formatting instructions:

**File:** `test/commands/subagent.test.ts`

Add:

```typescript
it("all agent prompts include formatting instructions", () => {
	const agents = getBuiltinAgents();
	for (const agent of agents) {
		expect(agent.prompt).toContain("plain text");
		expect(agent.prompt).toContain("no markdown");
	}
});
```

**File:** `test/commands/agent.test.ts`

Add (requires reading the source or exporting the constant):

```typescript
it("general agent prompt includes formatting rules", () => {
	// Read the agent command source to verify prompt content
	const source = readFileSync(
		join(import.meta.dirname, "..", "src", "commands", "agent.ts"),
		"utf-8"
	);
	expect(source).toContain("NO markdown headers");
	expect(source).toContain("pipeline approve");
});
```

---

## 8. Files Changed Summary

| File | Change |
|---|---|
| `src/commands/agent.ts` | Replace `SYSTEM_PROMPT` with detailed formatting instructions |
| `src/services/subagents.ts` | Rewrite all 4 built-in agent prompts with explicit format rules |
| `test/commands/subagent.test.ts` | Add prompt content regression test |
| `test/commands/agent.test.ts` | Add prompt content regression test |
