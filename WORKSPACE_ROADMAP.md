# ClawSuite Workspace + Agent Hub — Shipping Roadmap

## What We Have (266 commits on feat/ux-polish-v3-handshake)

### Agent Hub (40+ components)
- **Agent Hub Layout** — main orchestration view
- **Sessions Screen** — real-time session monitoring
- **Cost Analytics** — token/cost tracking per agent/model
- **Live Feed Panel** — streaming agent activity
- **Kanban Board** — visual task management
- **Task Board** — task assignment and tracking
- **Mission Timeline** — goal → task → checkpoint flow
- **Mission Event Log** — full audit trail
- **Run Console** — live agent output
- **Run Compare** — A/B agent results
- **Run Learnings** — captured insights from runs
- **Approvals Panel** — human-in-the-loop gates
- **Team Panel** — agent roster and status
- **Office View** — visual "who's working on what"
- **Calendar/Agenda View** — scheduled tasks
- **Template Picker** — reusable task templates
- **Config Wizards** — onboarding and setup
- **Collaboration Presence** — who's online
- **Remote Agents Panel** — distributed agent management

### Workspace
- **Workspace Layout** — orchestration shell
- **Terminal Workspace** — PTY grid for agent terminals
- **Workspace Store** — state management
- **Mission Store** — goal/task/checkpoint state

### Infrastructure
- Multi-model routing (10+ providers)
- Electron desktop app
- Gateway auto-discovery
- Memory browser
- Device pairing
- Cloud provisioning (Polar webhooks)

---

## What to Steal from OpenMOSS

### 1. Patrol Agent (Self-Healing)
**What:** Dedicated agent that monitors all other agents, detects stuck/failed tasks, triggers recovery
**Implementation:** Cron job (every 15 min) that:
- Checks all active sessions for heartbeat/progress
- Flags sessions with no output for >10 min as "stuck"
- Attempts restart or reassignment
- Alerts user if auto-recovery fails
**Where:** New cron job + small component in Agent Hub
**Effort:** 1 day

### 2. Agent Scoring & Leaderboard
**What:** Track agent success rate, speed, quality per task type
**Implementation:**
- After each task completion, score: did it pass review? How many retries? Token cost?
- Aggregate into agent "reliability score"
- Show in Team Panel as leaderboard
- Use scores to auto-select best agent for task type
**Where:** Team Panel + new scoring store
**Effort:** 2 days

### 3. Task Lifecycle States
**What:** Clean state machine: pending → assigned → in_progress → in_review → done/blocked
**Implementation:** Formalize the mission/checkpoint flow into explicit states
- Visual state badges on Kanban/Task Board
- Blocked state triggers Patrol agent
- Review state gates human approval
**Where:** Mission Store + Kanban Board
**Effort:** 1 day

---

## What to Steal from Other Tools

### Claude Squad / Agent Deck
- **Multi-agent session tabs** — switch between agent sessions like browser tabs
- **Agent-specific workspaces** — each agent gets its own isolated file context

### CrewAI / AutoGen
- **Role-based agent creation** — templates for Planner, Coder, Reviewer, Researcher
- **Agent-to-agent messaging** — agents can request help from each other (THE BOARDROOM)

### Cursor
- **Inline code diffs** — show what agents changed, side-by-side
- **Accept/Reject per-change** — granular approval, not all-or-nothing

---

## Shipping Plan

### Phase 1: Push ClawSuite (THIS WEEK)
- [ ] Decision: cherry-pick stability fixes OR full 266-commit push
- [ ] tsc clean (already done)
- [ ] Quick smoke test on mobile
- [ ] Push to main
- [ ] Update README with workspace docs

### Phase 2: Workspace Polish (1 week)
- [ ] Add Patrol Agent (cron-based self-healing)
- [ ] Add task lifecycle states to Kanban
- [ ] Add agent scoring to Team Panel
- [ ] Wire "Boardroom" — shared context panel where agents see each other's output
- [ ] Test end-to-end: create goal → auto-decompose → agents execute → review → merge

### Phase 3: Universal Agent Framework (2 weeks)
- [ ] Abstract OpenClaw dependency into adapter interface
- [ ] Build adapter: Claude Code (ACP protocol)
- [ ] Build adapter: Codex CLI (stdin/stdout)
- [ ] Build adapter: Hermes (WebAPI — already built)
- [ ] Build adapter: Aider (CLI)
- [ ] New repo, new brand, new landing page
- [ ] Agent Marketplace — browse/install agent adapters

### Phase 4: Ship & Grow
- [ ] Launch universal workspace on Product Hunt / HN
- [ ] Community adapter contributions
- [ ] Premium features for ClawSuite (advanced orchestration, cloud agents)

---

## The Two Products

### ClawSuite (OpenClaw-native, premium)
- Best experience for OpenClaw users
- Advanced features: cloud provisioning, device pairing, Electron app
- Revenue: subscription tiers via Polar

### [Universal Workspace] (framework-agnostic, open-source)
- Fork of ClawSuite with adapter layer
- Works with any agent framework
- Community-driven adapters
- Revenue: hosting, premium orchestration features, enterprise

---

## Name Candidates for Universal Product
- Nexus
- Hive
- Cortex
- AgentOS
- Switchboard
- Pylon
- CommandPost
- [TBD — Eric's pick]
