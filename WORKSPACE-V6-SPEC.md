# Workspace V6 — "Automate Your Projects"

_Written: 2026-03-21 11:38 PM EST_
_Context: Full architecture audit complete. Conductor UI is partially broken. Workspace screens have the real capability. Daemon core (tracker, scheduler, checkpoints, SSE) is solid. Adapters are dead weight — OpenClaw sessions_spawn is the only execution path that matters._

---

## The Product

**One sentence:** User specs a project → agents plan, research, build, and review autonomously → user watches live or turns on hands-free mode where Aurora oversees quality.

**The pitch:** "Automate Your Projects"

---

## Current State (What We Have)

### Working ✅
- **Tracker** — SQLite persistence for projects, phases, missions, tasks, runs, checkpoints, events (2,733 lines, solid)
- **Scheduler** — dependency-wave dispatch, concurrency limiting (130 lines)
- **Checkpoint system** — capture diffs, verification (tsc/lint/test), approve/reject/revise/merge/PR routes (771 lines in routes, 255 in builder)
- **QA Runner** — OpenClaw sub-agent scoring with confidence threshold (241 lines)
- **SSE** — real-time event fan-out to all connected UIs (82 lines)
- **Decomposer** — LLM-based task decomposition with clarifying questions (263 lines)
- **Auto-approve toggle** — `auto_approve` per-project in SQLite, UI toggle labeled "hands-free mode"
- **Workspace screens** — project wizard, project detail, checkpoint detail modal, mission console, review inbox, KPI dashboard (~9.4K lines)
- **Conductor** — clean mission input UI, recent missions, preview phase (~2.4K lines)

### Broken / Dead Weight ❌
- **Codex adapter** (827 lines) — one-shot JSON-RPC, no multi-turn, no session persistence. DELETE.
- **Claude adapter** (309 lines) — one-shot CLI process. DELETE.
- **OpenClaw adapter** (174 lines) — has session_id capture + steering, but wrapped behind wrong `execute()` contract. REPLACE with direct HTTP calls.
- **Agent runner** (166 lines) — thin wrapper around adapters. REWRITE as mission loop.
- **Conductor as separate screen** — partially broken API contracts, wrong endpoints, reimplements workspace features worse. MERGE into workspace.
- **5+ frontend calls to nonexistent daemon routes** (`/stats`, `/files`, `/daemon/restart`, `/task-runs/:id/message`, `/api/workspace-tasks`)

### The Gap
- No autonomous mission loop (agent finishes → nothing happens until human acts)
- No revision loop (QA rejects → task fails → dead end)
- No overseer system (hands-free has no fallback when QA is uncertain)
- No multi-agent roles per mission (everything uses one generic agent)
- Two competing UIs that don't share components
- Execution goes through adapter layer instead of OpenClaw directly

---

## Target Architecture

### Principles
1. **Daemon owns state, OpenClaw owns execution.** Daemon tracks missions/tasks/checkpoints in SQLite. OpenClaw spawns and manages agent sessions.
2. **One UI surface.** Workspace screen absorbs Conductor's mission input. No separate Conductor route.
3. **Programmatic mission loop.** The daemon drives the autonomous cycle in TypeScript — not an LLM holding state in context.
4. **Aurora as overseer, not orchestrator.** In hands-free mode, the daemon loop handles the happy path. Aurora gets paged only for ambiguous decisions.

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    WORKSPACE UI                          │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │
│  │ Mission   │ │ Active   │ │ Review    │ │ Project  │  │
│  │ Input     │ │ Monitor  │ │ Inbox     │ │ Detail   │  │
│  │(ex-Cond.) │ │(live SSE)│ │(chkpts)   │ │(full)    │  │
│  └──────────┘ └──────────┘ └───────────┘ └──────────┘  │
│                       ↕ SSE + REST                       │
├─────────────────────────────────────────────────────────┤
│                 WORKSPACE DAEMON (:3099)                  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │
│  │ Tracker   │ │ Mission  │ │ Checkpoint│ │ Scheduler│  │
│  │ (SQLite)  │ │ Loop     │ │ Builder   │ │ (waves)  │  │
│  └──────────┘ └──────────┘ └───────────┘ └──────────┘  │
│                       ↕ HTTP                             │
├─────────────────────────────────────────────────────────┤
│                    OPENCLAW GATEWAY                       │
│  ┌──────────────────────────────────────────────────┐    │
│  │ sessions_spawn / sessions_send / sessions_list    │    │
│  │ → Codex CLI, Claude Code, local models, etc.     │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (fix what's broken)

### 1A. Fix API Contract Drift
**Effort: S | No new features, just correctness**

- Replace ALL `/api/workspace-tasks` calls with `/api/workspace/tasks` in:
  - `src/screens/gateway/hooks/use-conductor-workspace.ts`
  - `src/screens/projects/projects-screen.tsx` (3 places)
- Add missing daemon routes or remove callers:
  - `GET /api/workspace/stats` — implement (aggregate from tracker: project count, active missions, pending checkpoints, total runs)
  - `GET /api/workspace/projects/:id/files` — implement (read project dir, return file tree)
  - `POST /api/workspace/daemon/restart` — remove caller (unnecessary, daemon restarts via process manager)
  - `POST /api/workspace/task-runs/:id/message` — defer to Phase 2 (needs session model)
- Fix SSE cache key mismatch: `use-workspace-sse.ts` must invalidate Conductor-specific query keys too

### 1B. Delete Dead Adapters
**Effort: S | Pure deletion**

- Delete `workspace-daemon/src/adapters/codex.ts` (827 lines)
- Delete `workspace-daemon/src/adapters/claude.ts` (309 lines)
- Delete `workspace-daemon/src/adapters/openclaw.ts` (174 lines)
- Delete `workspace-daemon/src/adapters/types.ts` (13 lines)
- Delete `workspace-daemon/src/adapters/` directory
- Total: ~1,323 lines removed

### 1C. Merge Conductor into Workspace
**Effort: M | UI reorganization**

**Goal:** Workspace gets Conductor's clean mission input as its landing view. Conductor route deleted.

- Extract from `conductor.tsx`:
  - Home phase (mission input card + recent missions + quick actions) → new `workspace-mission-input.tsx` component
  - Preview phase (decomposition review with task toggles) → new `workspace-decompose-review.tsx` component
- Integrate into `workspace-layout.tsx`:
  - Mission input becomes the default "home" tab or hero section at top of Projects tab
  - When a mission is active, workspace shows it inline (not a separate phase view)
  - Active mission monitoring uses existing `MissionConsoleScreen` (already exists, already works)
  - Checkpoint review uses existing `checkpoint-detail-modal.tsx` (already the best review UI)
- Delete:
  - `src/screens/gateway/conductor.tsx` (~1,630 lines)
  - `src/screens/gateway/hooks/use-conductor-workspace.ts` (~819 lines)
  - Conductor route registration
- Keep / absorb:
  - Recent missions pagination logic
  - Mission input card styling
  - localStorage mission persistence
  - Phase-aware status indicators

**Workspace tab structure after merge:**
```
[Mission Input (hero)]     ← from Conductor home
[Projects] [Missions] [Review Inbox] [Agents] [Settings]
                                                  └── hands-free toggle (already exists)
```

---

## Phase 2: Mission Loop (the core feature)

### 2A. Rewrite Agent Runner as Mission Loop
**Effort: L | The key architectural change**

Replace `workspace-daemon/src/agent-runner.ts` with `workspace-daemon/src/mission-loop.ts`:

```typescript
// mission-loop.ts — Programmatic autonomous mission execution
// 
// This replaces the old adapter-based agent-runner.
// Execution happens through OpenClaw's HTTP API (sessions_spawn).
// The daemon drives the loop; OpenClaw provides the agents.

interface MissionLoopConfig {
  openclawBaseUrl: string        // e.g. http://localhost:3000
  openclawToken?: string         // auth token if needed
  pollIntervalMs: number         // how often to check for ready tasks (default: 5000)
  sessionTimeoutMs: number       // max time to wait for an agent session (default: 600000)
  maxRevisionsPerTask: number    // how many times to retry a failed task (default: 3)
  qualityThreshold: number       // QA confidence needed for auto-approve (default: 0.85)
  overseerEnabled: boolean       // if true, page Aurora on ambiguous decisions
  overseerAgentId?: string       // OpenClaw agent ID for overseer (e.g. "aurora")
}

// The loop:
// 1. Poll tracker for missions with status "running"
// 2. For each running mission, get ready tasks (dependencies satisfied)
// 3. For each ready task:
//    a. Call OpenClaw POST /api/sessions/spawn with task prompt + agent config
//    b. Poll session status until complete or timeout
//    c. Capture result, build checkpoint (diff, verification)
//    d. Score checkpoint via QA runner
//    e. If score >= threshold → approve, merge, mark task complete
//    f. If score < threshold AND revisions < max → create revision task with feedback
//    g. If score < threshold AND revisions >= max → mark task failed, page overseer
// 4. When all tasks complete → mark mission complete
// 5. Emit SSE events at every state change
```

**Key design decisions:**
- The loop is a `setInterval` in the daemon process, not a cron job
- Each iteration reads fresh state from SQLite (survives daemon restart)
- OpenClaw sessions are fire-and-forget — daemon polls for completion
- No adapter abstraction. Direct HTTP calls to OpenClaw API.
- Agent selection: task's `suggested_agent_type` maps to OpenClaw agent IDs configured in project settings

### 2B. OpenClaw Session Client
**Effort: S | Simple HTTP wrapper**

New file: `workspace-daemon/src/openclaw-client.ts`

```typescript
interface OpenClawClient {
  // Spawn a new agent session
  spawnSession(params: {
    task: string
    agentId?: string           // named agent or default
    model?: string             // model override
    label?: string             // visible in OpenClaw hub
    cwd?: string               // working directory for the agent
    runTimeoutSeconds?: number
  }): Promise<{ sessionKey: string }>

  // Check session status
  getSessionStatus(sessionKey: string): Promise<{
    status: 'running' | 'completed' | 'failed' | 'timeout'
    lastMessage?: string
    tokenUsage?: { input: number; output: number }
  }>

  // Send a message to a running session (for steering / revision)
  sendMessage(sessionKey: string, message: string): Promise<void>

  // Get session history (for checkpoint content)
  getSessionHistory(sessionKey: string): Promise<Message[]>

  // Fire a system event (to page Aurora or user)
  systemEvent(text: string): Promise<void>
}
```

This replaces all three adapters with ~100 lines of HTTP calls.

### 2C. Persist Agent Type on Tasks
**Effort: S | Schema + route fix**

- Add `agent_type TEXT` column to tasks table (migration)
- Update task creation route to accept and store `agent_type`
- Update decomposer output parsing to preserve `suggested_agent_type`
- Update scheduler to pass agent_type to mission loop

### 2D. Mission State Machine
**Effort: M | Explicit lifecycle**

Replace implicit status derivation with explicit mission states:

```
planned → decomposing → ready → running → reviewing → revising → completed
                                              ↓            ↑
                                          failed ──────────┘ (if retryable)
                                              ↓
                                          abandoned (max retries exceeded)
```

- `reviewing` = at least one checkpoint pending review
- `revising` = revision task spawned, agent working on fix
- Transitions tracked in tracker with timestamps
- SSE events on every transition

---

## Phase 3: Overseer System

### 3A. Aurora as Overseer
**Effort: M | The "hands-free mode" completion**

When a project has `auto_approve: true` AND `overseer: "aurora"`:

1. **Happy path (QA score ≥ threshold):** Daemon auto-approves. No human or Aurora needed.
2. **Uncertain (QA score between 0.5 and threshold):** Daemon fires system event to Aurora's session:
   ```
   "Workspace checkpoint needs review: [mission name] task [task name].
   QA score: 0.72. Concerns: [qa feedback].
   Review checkpoint ID [id] and approve/reject/revise."
   ```
   Aurora reviews (reads diff, checks tsc, maybe reads files), then calls daemon API to approve/reject/revise.
3. **Failed (QA score < 0.5 or agent error):** Daemon auto-creates revision task with QA feedback. If max revisions hit, pages Aurora.
4. **Ambiguous (agent asked questions, needs human input):** Pages user directly via Telegram/Discord notification.

**Implementation:**
- Add `overseer` field to project config (nullable string, agent ID)
- Mission loop checks overseer config on each checkpoint
- System event format is structured so Aurora can parse and act
- Cron job (every 15 min) to catch any missed overseer pages

### 3B. Overseer Cron Job
**Effort: S | Safety net**

```
Schedule: every 15 minutes
Task: Check for projects with overseer enabled that have pending checkpoints older than 10 minutes
Action: Fire system event to overseer agent with checkpoint details
Model: ollama-pc2/qwen3:8b (free)
```

This catches cases where the real-time page was missed (compaction, session restart, etc).

---

## Phase 4: Multi-Agent Roles

### 4A. Agent Role Configuration
**Effort: M | Project-level agent roster**

Each project can configure agent roles:

```json
{
  "agents": {
    "planner": { "model": "anthropic-oauth/claude-sonnet-4-6", "prompt_prefix": "You are a project planner..." },
    "researcher": { "model": "minimax/MiniMax-M2.5-Lightning", "prompt_prefix": "You are a research agent..." },
    "coder": { "model": "openai-codex/gpt-5.4", "prompt_prefix": "You are a coding agent..." },
    "critic": { "model": "anthropic-oauth/claude-sonnet-4-6", "prompt_prefix": "You are a code reviewer..." }
  }
}
```

- Stored in project config (JSON column in SQLite)
- UI: agent configuration panel in project settings (already partially exists in `routes/agents.ts`)
- Decomposer assigns `agent_type` per task based on task nature
- Mission loop maps `agent_type` → project agent config → OpenClaw spawn params

### 4B. Critic Loop
**Effort: M | Automated code review before checkpoint**

After coder agent completes:
1. Mission loop captures output
2. Before creating checkpoint, spawns critic agent with:
   - The task description
   - The diff produced
   - Instruction: "Review this code. Score 1-10. List issues. If score < 7, explain what needs fixing."
3. If critic score ≥ 7 → proceed to checkpoint + QA
4. If critic score < 7 → create revision task with critic feedback → coder runs again
5. Max 2 critic loops per task before escalating to checkpoint (human/overseer review)

This gives us: `coder → critic → (revise if needed) → checkpoint → QA → approve/revise`

---

## Phase 5: UI Polish

### 5A. Active Mission Monitor
**Effort: M | Real-time mission cockpit**

Replace Conductor's broken active phase with a proper mission monitor built on existing components:

- **Task progress** — list of tasks with status dots, dependency arrows, elapsed time
- **Live agent output** — connect to OpenClaw session via SSE (use existing `MissionConsoleScreen` pattern which already reads `session_id` from task runs)
- **Checkpoint cards** — inline with approve/reject/steer using existing `checkpoint-detail-modal`
- **Steer input** — text input that calls `sessions_send` to the active agent's session
- **Hands-free indicator** — green badge when auto-approve is on, shows overseer status

### 5B. Mission Input Redesign
**Effort: S | Clean up merged component**

The mission input (from Conductor) in workspace should:
- Accept project goal as freeform text
- Show "Configure" expandable for: agent roles, auto-approve, project path, required checks
- "Launch" button that: creates project → decomposes → creates tasks → starts mission loop
- Recent missions below with status, progress bar, quick-resume

### 5C. Responsive Layout
**Effort: S | Mobile fix**

- Mission monitor: single column on mobile, collapsible task list
- Checkpoint review: full-screen modal on mobile (already works in checkpoint-detail-modal)

---

## Implementation Order

| Step | What | Effort | Depends On | Deletes | Adds |
|------|------|--------|------------|---------|------|
| 1A | Fix API contract drift | S | — | 0 lines | ~50 lines |
| 1B | Delete dead adapters | S | — | ~1,323 lines | 0 lines |
| 1C | Merge Conductor into Workspace | M | 1A | ~2,449 lines | ~400 lines (extracted components) |
| 2B | OpenClaw session client | S | 1B | 0 lines | ~100 lines |
| 2C | Persist agent_type on tasks | S | — | 0 lines | ~30 lines |
| 2A | Mission loop | L | 2B, 2C | ~166 lines (old agent-runner) | ~300 lines |
| 2D | Mission state machine | M | 2A | ~50 lines (implicit status logic) | ~150 lines |
| 3A | Aurora overseer | M | 2A, 2D | 0 lines | ~150 lines |
| 3B | Overseer cron | S | 3A | 0 lines | ~30 lines (cron config) |
| 4A | Agent role config | M | 2A | 0 lines | ~200 lines |
| 4B | Critic loop | M | 4A, 2A | 0 lines | ~150 lines |
| 5A | Active mission monitor | M | 1C, 2A | 0 lines | ~500 lines |
| 5B | Mission input redesign | S | 1C | 0 lines | ~100 lines |
| 5C | Responsive layout | S | 5A | 0 lines | ~50 lines |

**Net code change estimate:** Delete ~4,000 lines, add ~2,200 lines. The codebase gets smaller AND more capable.

**Critical path:** 1A → 1B → 2B → 2A → 2D → 3A (then UI in parallel)

---

## What We're NOT Building

- ❌ Custom adapter framework — OpenClaw IS the adapter
- ❌ Daemon-owned agent sessions — OpenClaw owns sessions
- ❌ Separate Conductor screen — merged into Workspace
- ❌ Codex JSON-RPC integration — just use sessions_spawn
- ❌ Multi-daemon architecture — one daemon, one OpenClaw, one UI
- ❌ Real-time streaming from daemon to agents — OpenClaw handles this, UI connects to OpenClaw SSE for live output

---

## Files to Delete (total ~4,000 lines)

```
workspace-daemon/src/adapters/codex.ts        (827 lines)
workspace-daemon/src/adapters/claude.ts        (309 lines)
workspace-daemon/src/adapters/openclaw.ts      (174 lines)
workspace-daemon/src/adapters/types.ts          (13 lines)
workspace-daemon/src/agent-runner.ts           (166 lines) → replaced by mission-loop.ts
src/screens/gateway/conductor.tsx            (1,630 lines) → extracted into workspace components
src/screens/gateway/hooks/use-conductor-workspace.ts (819 lines) → logic merged into workspace hooks
CONDUCTOR-AUDIT.md                             (delete after migration)
CONDUCTOR-MERGE-SPEC.md                        (delete after migration)
CONDUCTOR-V2-SPEC.md                           (delete after migration)
```

## Files to Create

```
workspace-daemon/src/mission-loop.ts           (~300 lines) — autonomous execution loop
workspace-daemon/src/openclaw-client.ts        (~100 lines) — HTTP client for OpenClaw API
src/screens/workspace/workspace-mission-input.tsx (~200 lines) — from Conductor home phase
src/screens/workspace/workspace-decompose-review.tsx (~200 lines) — from Conductor preview phase
```

## Files to Modify

```
workspace-daemon/src/orchestrator.ts           — remove adapter refs, wire mission loop
workspace-daemon/src/server.ts                 — mount new routes, remove adapter init
workspace-daemon/src/tracker.ts                — add agent_type column, mission state machine
workspace-daemon/src/db/schema.sql             — add agent_type, overseer fields
workspace-daemon/src/db/index.ts               — migration for new columns
workspace-daemon/src/routes/tasks.ts           — accept agent_type
workspace-daemon/src/routes/projects.ts        — add /stats, /files endpoints
workspace-daemon/src/config.ts                 — add overseer config
src/screens/workspace/workspace-layout.tsx     — integrate mission input, overseer toggle
src/screens/projects/projects-screen.tsx        — fix /api/workspace-tasks → /api/workspace/tasks
src/hooks/use-workspace-sse.ts                 — fix cache key invalidation
```

---

## Success Criteria

When this is done, the demo is:

1. Open ClawSuite → Workspace
2. Type "Build a landing page for a SaaS product with pricing tiers"
3. Click Launch → watch decomposition → tasks appear with agent assignments
4. Agents spawn automatically — planner → researcher → coder → critic
5. Live output streaming shows what each agent is doing
6. Checkpoints appear as agents complete work
7. With hands-free ON: Aurora reviews ambiguous checkpoints, approves good ones
8. With hands-free OFF: user reviews each checkpoint with full diff/verify UI
9. Mission completes → output files viewable → PR ready

That's the product. Everything in this spec serves that demo.
