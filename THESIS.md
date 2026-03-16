# Pipeline

**An AI-native operating system that lets one person sell, deliver, and run a business from the terminal.**

---

## The Problem

You're a developer-founder. You closed that consulting deal with Acme — congratulations. Now you have to deliver it. And while you're delivering, three other prospects are going cold because you haven't followed up. And while you're catching up on follow-ups, you realize you forgot to invoice the last project. And somewhere in the background, a warm intro is sitting in your inbox, unanswered for nine days.

You're not bad at this. You're one person doing the work of four teams: sales, delivery, ops, and client management. The tools that exist are built for those teams — Hubspot for sales, Asana for project management, Apollo for outbound, Mailchimp for campaigns. Each assumes you have a department behind you. You don't. You have a terminal and a to-do list in your head.

So things fall through the cracks. Not because you can't sell or deliver — because no single tool spans the full lifecycle from first touch to final invoice. You close the deal, and the system of record resets. "Closed-won" is where your CRM ends and your chaos begins.

---

## What It Looks Like

**Sell.** The agent finds who's going cold and drafts follow-ups. You approve and send.

```
$ pipeline agent:follow-up

Analyzing pipeline... 3 contacts need attention:

  Jane Smith (Acme Corp) — last contact 16 days ago, $15k deal in proposal
  → Proposed: follow-up email referencing Q2 timeline discussion

  Bob Lee (Startup.io) — last contact 22 days ago, introduced by Marc
  → Proposed: casual check-in about AI consulting work

  Sarah Chen (Sequoia) — no open deal, 11 days since last touch
  → Proposed: share latest product update

Run `pipeline approve` to review and send.
```

**Close and deliver.** The deal converts into a project with milestones. A delivery agent monitors progress.

```
$ pipeline deal:close acme --won --create-project

✓ Deal "Acme Consulting" closed as won ($15,000)
✓ Project "Acme Consulting" created

$ pipeline milestone:add "Deliver v1" --project acme --due 2026-04-01
$ pipeline milestone:add "Final review" --project acme --due 2026-04-15

$ pipeline agent:delivery-check

Reviewing active projects...

  Acme Consulting — 1 of 2 milestones complete, on track
  → No action needed

  Widget Co Buildout — milestone "MVP" overdue by 3 days
  → Proposed: task to follow up with Widget Co on blockers
```

**Operate.** Scheduled agents run on cron. The system works while you build.

```
$ pipeline schedule:add follow-up --interval weekdays
$ pipeline schedule:add digest --interval daily
$ pipeline schedule:install

✓ Cron installed — schedules will run automatically

$ pipeline dashboard

Pipeline: 4 active deals worth $62,000
  Closing this week: Acme Consulting ($15k, proposal)
  Stale: 2 contacts need attention
  Overdue: 1 task
  Pending actions: 3 awaiting approval
  Projects: 2 active, 1 on track, 1 needs attention
```

One person. One terminal. The full lifecycle.

---

## The Insight

The sell-deliver loop is broken for solo operators. CRM, project management, email automation, ops — these are separate tools designed for separate teams. A solo founder doesn't need four dashboards. They need one system of record that spans the full lifecycle, with agents managing each phase.

An agent that monitors your pipeline, notices a deal going cold, drafts a follow-up, and queues it for your approval — that agent needs a structured system to operate against. Not a spreadsheet. Not a JSON file. A database with a relationship graph, interaction history, delivery tracking, and a schema the agent can query and update through well-defined tools.

And the most natural interface for both a human developer and an AI agent is the same thing: a command line. Text in. Text out. Composable. Scriptable. Pipeable. The CLI is the universal interface for humans and machines.

Pipeline is that system of record — not just for sales, but for the entire lifecycle from first touch to final delivery.

---

## The Product

Pipeline is a CLI-native operating system for running a business. Built for people who have relationships that matter — not 10,000 anonymous leads in a funnel, but the 50 or 500 relationships that actually drive their business, and the projects that follow.

**It's local-first.** A single SQLite file. No server. No account. `npx pipeline init` and you're running. Your data never leaves your machine unless you want it to.

**It's fast.** Every command runs and exits. No spinners, no loading screens, no dashboards to wait for. `pipeline deal list` is instant. You get your answer and go back to work.

**It's a graph, not a spreadsheet.** Your business is a network: people work at companies, companies have deals, deals have interactions, people introduce other people. Pipeline models these relationships as a traversable graph. `pipeline related jane` shows you the full picture — her company, your deal, every email, every meeting, who introduced her — in one command.

**It's AI-native.** Nine built-in agents with 27 MCP tools, agent memory, and support for custom agents. Not a chatbot bolted onto a database — agents operating against a structured system of record. Every action is proposed for your approval. You stay in control.

**It follows the deal past the close.** Projects, milestones, a delivery-check agent. Most CRMs end at "closed-won." Pipeline starts a new phase. `deal:close --create-project` converts a won deal into a tracked delivery with milestones, and an agent that monitors whether you're on track.

**It runs while you sleep.** Scheduled agents execute on cron. Event hooks trigger agents when things change — a contact goes stale, a milestone goes overdue, a deal sits too long in one stage. The system proposes actions on a schedule; you approve them in the morning.

---

## Who It's For

Developer-founders. Solo technical founders. Indie hackers. Freelance engineers selling consulting. Agency owners of one. Anyone who builds for a living and also has to sell, deliver, and retain.

These are people delivering agency-level outcomes as solo operators. They don't just close deals — they close, deliver, follow up, and close again. As AI reshapes how work gets done, more people are running businesses this way — by choice or necessity. One person, full stack, full lifecycle.

People who:
- Have a terminal open all day
- Find Hubspot offensive
- Are leaving money on the table by not following up — or by not delivering on time
- Would rather type a command than click through a form
- Want AI agents that propose, not AI that acts unsupervised

---

## Why Not Just X?

**Why not Hubspot/Pipedrive?** You already know. You tried it, entered three contacts, and never went back. It's a web app built for full-time salespeople. You're not one.

**Why not Hubspot + Asana + Apollo?** Because you don't need three tools for three teams. You're one person. You need one system that spans sales, delivery, and ops — not three apps with three dashboards, three logins, and zero integration between them.

**Why not a spreadsheet?** No agent layer. No relationship graph. No delivery tracking. No follow-up reminders. And you'll abandon it in two weeks for the same reason you abandon every spreadsheet.

**Why not just ask Claude Code to track contacts in a file?** Because Claude Code doesn't persist state between sessions. It has no structured schema, no relationship graph, no approval workflow, no delivery tracking, no scheduling. Pipeline gives the agent 27 purpose-built MCP tools for CRM and delivery operations — searching contacts, traversing relationships, checking project health, recalling agent memory, proposing actions. And critically, the agent can only propose, never act. That's the safety guarantee.

---

## Why Now

Four things are converging:

**1. AI agents work now.** Not theoretical — production-ready. Claude's tool-use API and the MCP protocol give us a full agent runtime: structured tool calls, context management, multi-step reasoning. A system with nine specialized agents monitoring your pipeline, your inbox, your delivery projects, and your follow-ups is something you can build today.

**2. Developer-founders are the new sales team.** The rise of solo founders, indie hackers, and small technical teams means more people are selling who were never trained to sell — and delivering who never had a project manager. They need tools shaped for their workflow, not adapted from enterprise playbooks.

**3. The terminal is having a moment.** Claude Code, Cursor, Warp, Ghostty, terminal-native AI tools — the command line is no longer a relic. It's where the most productive developers are choosing to work. A business operating system that meets them there isn't a compromise, it's a feature.

**4. The solopreneur wave.** AI is collapsing the gap between a solo operator and an agency. More people are going independent — building, selling, and delivering on their own. They don't need enterprise tools scaled down. They need lightweight, AI-native systems that let one person run a business with software-like margins. The operating system for that person doesn't exist yet.

---

## How It's Different

| | Traditional Stack | Pipeline |
|---|---|---|
| Sales CRM | Hubspot / Pipedrive | Built-in: contacts, deals, graph |
| Project management | Asana / Notion | Projects + milestones from won deals |
| Email automation | Apollo / Mailchimp | Agent-drafted, human-approved emails |
| Follow-ups | You remember (you won't) | 9 agents monitoring and proposing |
| Ops / scheduling | Manual | Cron-scheduled agents, event hooks |
| Interface | 4 browser tabs | One terminal |
| AI | Bolted-on copilots | Native agents with approval workflow |
| Data | Their clouds | Your SQLite file |

---

## The Bet

We're betting that one person with the right AI-native tools can deliver agency-level outcomes with software-like margins.

The entire sell-deliver-retain loop — handled by one system of record, with agents managing each phase. Not a better CRM. Not a better project manager. A lightweight operating system for running a business.

The system of record that spans the full lifecycle, where every relationship, every deal, every delivery, and every interaction compounds over time, is the next great category of business software. Pipeline is building it.

We're also betting on the human-in-the-loop. Agents propose. Humans approve. The system gets smarter with agent memory and a deepening relationship graph, but the human never loses control. That's not a limitation — it's the product.

---

## What Success Looks Like

**Now:** Open-source CLI with 9 agents, delivery tracking, email sync, scheduling, event hooks, agent memory, and a dashboard. Early adopters using it daily to run real businesses.

**Next:** Cloud sync for multi-device access. Team mode for small firms. Inbound lead capture. Stripe integration for delivery invoicing. Plugin ecosystem for custom integrations.

**Vision:** Pipeline is the default operating system for technical solopreneurs. "I run my business on Pipeline" is a signal. The relationship graph, delivery history, and agent memory compound over time — the system gets smarter the longer you use it. One person, one terminal, agency-level outcomes.
