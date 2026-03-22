# Workspace Architecture Audit

## 1. Executive Summary

ClawSuite already has a real workspace daemon, a real SQLite-backed execution model, real task orchestration, real checkpoints, and a mostly real review loop. What it does **not** have is a coherent single product surface. The legacy workspace/projects screens are the actual control plane today; Conductor is a partially integrated alternate UI that sits on stale and sometimes nonexistent API contracts. The daemon is strongest at CRUD, scheduling, worktree management, checkpoint capture, verification, and SSE fan-out. The daemon is weakest at agent conversation, durable session management, route consistency, and end-to-end autonomous mission handling after the first task run. Codex and Claude are one-shot adapters; only OpenClaw has a continuation path, so “reply to agent” is mostly fiction outside OpenClaw-backed runs. The approval model is also internally inconsistent: “manual review” can still be auto-approved by QA when confidence is high. The system today is a mission/task/checkpoint control plane with multiple competing frontends, not a unified conductor that can drive agents through a full autonomous loop. The main architectural problem is not lack of features; it is contract drift, duplicated UI surfaces, and the absence of a first-class conversational run/session model. The fastest path forward is to keep the daemon core, promote one orchestration contract, delete dead routes/calls, and decide whether agent execution lives behind daemon-owned sessions, OpenClaw-owned sessions, or a hybrid with a strict session abstraction.

## 2. Component Map

### Workspace Daemon

| File | LOC | What it does | Health |
| --- | ---: | --- | --- |
| `workspace-daemon/src/server.ts` | 123 | Boots Express, `Tracker`, `Orchestrator`, mounts all daemon routes, exposes config/version/recent-paths | Partial |
| `workspace-daemon/src/orchestrator.ts` | 605 | Schedules ready tasks, selects agents, dispatches runs, handles retries/pause/stop, tracks in-memory running state | Partial |
| `workspace-daemon/src/agent-runner.ts` | 166 | Creates workspace, builds final prompt, calls adapter, builds checkpoint after completion | Partial |
| `workspace-daemon/src/tracker.ts` | 2733 | Core persistence/service layer for projects, phases, missions, tasks, runs, checkpoints, events, teams, agents, SSE | Working |
| `workspace-daemon/src/checkpoint-builder.ts` | 255 | Stages diffs, creates checkpoints, runs verification, runs QA, optionally auto-merges | Partial |
| `workspace-daemon/src/qa-runner.ts` | 241 | Runs QA review through OpenClaw subagent and parses verdict JSON | Partial |
| `workspace-daemon/src/decomposer.ts` | 263 | LLM or fallback task decomposition, always injects a clarifying task | Partial |
| `workspace-daemon/src/scheduler.ts` | 130 | Computes dependency waves and provider-constrained dispatch order | Working |
| `workspace-daemon/src/workspace.ts` | 165 | Resolves safe project path, blocks repo self-targeting, creates git worktrees or ephemeral `/tmp/conductor-*` workspaces | Partial |
| `workspace-daemon/src/config.ts` | 159 | Reads workflow config/frontmatter and renders prompts/hooks | Working |
| `workspace-daemon/src/verification.ts` | 159 | Runs `tsc`, optional lint/test/e2e discovery | Partial |
| `workspace-daemon/src/git-ops.ts` | 78 | Worktree merge/cleanup and PR creation helpers | Partial |
| `workspace-daemon/src/context-builder.ts` | 83 | Builds task context snapshots for prompting | Partial |
| `workspace-daemon/src/types.ts` | 527 | Shared type definitions for daemon, tasks, runs, checkpoints, QA, workflow | Partial |
| `workspace-daemon/src/db/index.ts` | 393 | Opens SQLite, applies schema and additive migrations | Working |
| `workspace-daemon/src/db/schema.sql` | 163 | Fresh-install schema for daemon DB | Partial |
| `workspace-daemon/src/routes/projects.ts` | 220 | Project CRUD, detail, git status, health | Working |
| `workspace-daemon/src/routes/phases.ts` | 34 | Phase creation | Working |
| `workspace-daemon/src/routes/missions.ts` | 115 | Mission list/status/start/pause/resume/stop | Working |
| `workspace-daemon/src/routes/tasks.ts` | 76 | Task list/create/update/run/list-runs | Partial |
| `workspace-daemon/src/routes/task-runs.ts` | 213 | Adhoc dispatch, task-run list/events JSON/retry/pause/stop/purge | Partial |
| `workspace-daemon/src/routes/checkpoints.ts` | 771 | Checkpoint list/detail/diff/verify/approve/reject/revise/merge/PR/commit | Working |
| `workspace-daemon/src/routes/decompose.ts` | 155 | Decomposes goal, optionally auto-creates phase/mission/tasks and starts mission | Partial |
| `workspace-daemon/src/routes/agents.ts` | 126 | Agent directory CRUD, stats, status | Working |
| `workspace-daemon/src/routes/teams.ts` | 88 | Teams list/create/update approval config | Working |
| `workspace-daemon/src/routes/skills.ts` | 129 | Lists workspace skills from disk and serves `SKILL.md` content | Working |
| `workspace-daemon/src/routes/events.ts` | 82 | Workspace SSE stream, activity/audit fetch, per-run SSE stream | Partial |
| `workspace-daemon/src/adapters/types.ts` | 13 | Minimal adapter interface: `execute()` only | Broken by design |
| `workspace-daemon/src/adapters/codex.ts` | 827 | Codex JSON-RPC adapter over `codex app-server` | Partial |
| `workspace-daemon/src/adapters/claude.ts` | 309 | Claude CLI one-shot process adapter | Partial |
| `workspace-daemon/src/adapters/openclaw.ts` | 174 | OpenClaw session spawn + SSE adapter + steering helper | Partial |

### Conductor UI

| File | LOC | What it does | Health |
| --- | ---: | --- | --- |
| `src/screens/gateway/conductor.tsx` | 1630 | Single-screen Conductor UI with home/preview/active/complete phases | Partial |
| `src/screens/gateway/hooks/use-conductor-workspace.ts` | 819 | Conductor-specific daemon API client and mission launch sequence | Broken/Partial |

### Workspace / Projects Screens

| File | LOC | What it does | Health |
| --- | ---: | --- | --- |
| `src/screens/workspace/workspace-layout.tsx` | 631 | Workspace shell, tabs, config, stats, overlays, mission console handoff | Partial |
| `src/screens/projects/projects-screen.tsx` | 2354 | Primary control-plane screen for projects, missions, review queue, decompose, launch | Partial |
| `src/screens/projects/project-detail-view.tsx` | 1903 | Deep project drill-down: phases, missions, tasks, checkpoints, runs, health, timeline | Working/Partial |
| `src/screens/projects/new-project-wizard.tsx` | 1199 | Guided project creation with policy fields and optional decompose-to-plan-review | Working/Partial |
| `src/screens/projects/checkpoint-detail-modal.tsx` | 630 | Rich checkpoint review UI: diff/detail/verify/revise/reject/approve | Working |
| `src/screens/projects/checkpoint-detail-modal-parts.tsx` | 164 | Shared checkpoint modal UI fragments | Working |
| `src/screens/projects/decompose-dialog.tsx` | 303 | Goal decomposition modal | Working/Partial |
| `src/screens/projects/create-project-dialog.tsx` | 330 | Direct project creation dialog | Working |
| `src/screens/projects/dashboard-project-cards.tsx` | 290 | Project dashboard cards | Working |
| `src/screens/projects/dashboard-review-inbox.tsx` | 247 | Pending review inbox widgets | Working |
| `src/screens/projects/dashboard-kpi-bar.tsx` | 110 | KPI summary bar | Working |
| `src/screens/projects/dashboard-agent-capacity.tsx` | 87 | Agent capacity summary | Working |
| `src/screens/projects/lib/workspace-types.ts` | 580 | Workspace/project frontend types and normalizers | Partial |
| `src/screens/projects/lib/workspace-utils.ts` | 585 | Derived metrics, task wave logic, review scoring, formatting helpers | Working |
| `src/screens/projects/lib/spec-file.ts` | 15 | Spec file helper | Working |

### What Works vs What Is Stubbed

- The daemon core works: project/mission/task/run/checkpoint records are persisted, status changes emit SSE, checkpoints can be reviewed and merged, and the scheduler can dispatch dependency-respecting runs.
- The workspace/project UI is the most complete frontend. It understands phases, missions, checkpoints, review actions, health snapshots, and task history.
- Conductor is not the source of truth. It renders a polished shell around an incomplete API layer.
- Several expected routes are simply absent: `/api/workspace/stats`, `/api/workspace/projects/:id/files`, `/api/workspace/daemon/restart`, `/api/workspace/task-runs/:id/message`, and the frontend-only alias `/api/workspace-tasks`.
- `suggested_agent_type` exists in decomposition output and tracker types, but is not actually persisted by the task schema or task routes.

## 3. Data Flow

### Actual Mission Lifecycle in Code

1. **Mission input**
   - Conductor takes freeform goal text in the home phase and calls `POST /api/workspace/decompose` through `useConductorWorkspace` (`src/screens/gateway/conductor.tsx:718-779`, `src/screens/gateway/hooks/use-conductor-workspace.ts:438-447`).
   - Projects UI can also decompose from dialogs/wizard (`src/screens/projects/projects-screen.tsx:690-763`, `src/screens/projects/new-project-wizard.tsx:504-529`).

2. **Decompose**
   - Route is implemented in `workspace-daemon/src/routes/decompose.ts:69-147`.
   - It gathers up to 200 existing files as context (`workspace-daemon/src/routes/decompose.ts:11-39`).
   - `Decomposer` injects a mandatory clarifying task if the model does not produce one (`workspace-daemon/src/decomposer.ts:10`, `workspace-daemon/src/decomposer.ts:125-139`).
   - If `project_id` is provided and no `mission_id`, the route **auto-creates phase + mission + tasks and starts the mission** (`workspace-daemon/src/routes/decompose.ts:113-140`).

3. **Create project / phase / mission / tasks**
   - Conductor manually creates project, phase, mission, then task-by-task launch (`src/screens/gateway/hooks/use-conductor-workspace.ts:694-775`).
   - This breaks because task creation posts to `/api/workspace-tasks` instead of `/api/workspace/tasks` (`src/screens/gateway/hooks/use-conductor-workspace.ts:495-504`).
   - The daemon task router only exists at `/api/workspace/tasks` (`workspace-daemon/src/server.ts:85-99`, `workspace-daemon/src/routes/tasks.ts:7-76`).
   - Projects UI repeats the same broken endpoint assumption in multiple places (`src/screens/projects/projects-screen.tsx:221`, `src/screens/projects/projects-screen.tsx:1247`, `src/screens/projects/projects-screen.tsx:1470`).

4. **Mission start**
   - Mission start route is real: `POST /api/workspace/missions/:id/start` (`workspace-daemon/src/routes/missions.ts`).
   - `Tracker.startMission()` marks mission running and primes ready tasks (`workspace-daemon/src/tracker.ts:2403`).
   - Orchestrator tick then pulls `mission_status === "running"` and `task.status === "ready"` tasks (`workspace-daemon/src/orchestrator.ts:280-301`).

5. **Agent selection and spawn**
   - `Orchestrator.selectAgent()` uses hardcoded regex routing to preferred named agents, then falls back to `suggested_agent_type`, then any online Codex agent (`workspace-daemon/src/orchestrator.ts:58-113`).
   - `dispatchTask()` resolves a safe project path and silently creates a new git repo if the path does not exist (`workspace-daemon/src/orchestrator.ts:332-355`).
   - Workspace preparation either creates a git worktree from a real repo or falls back to an ephemeral `/tmp/conductor-*` directory (`workspace-daemon/src/workspace.ts:34-47`, `workspace-daemon/src/workspace.ts:87-137`).
   - `AgentRunner.runTask()` builds the final prompt, appends recent git log, and calls the adapter once (`workspace-daemon/src/agent-runner.ts:35-137`).

6. **Run execution**
   - Codex adapter starts a fresh thread and a single turn via JSON-RPC, streams deltas, and tears down the process when the turn ends (`workspace-daemon/src/adapters/codex.ts:720-757`, `workspace-daemon/src/adapters/codex.ts:481-527`).
   - Claude adapter is a single CLI process with `-p <prompt>` and no reusable session (`workspace-daemon/src/adapters/claude.ts:102-309`).
   - OpenClaw spawns a named session and records `session_id` when returned by the API (`workspace-daemon/src/adapters/openclaw.ts:42-76`, `workspace-daemon/src/adapters/openclaw.ts:86-96`, `workspace-daemon/src/adapters/openclaw.ts:143-153`).

7. **Checkpoint creation**
   - After any completed run, `AgentRunner` calls `buildCheckpoint()` (`workspace-daemon/src/agent-runner.ts:141-164`).
   - Checkpoint builder stages all changes, captures committed + staged diffs, stores `raw_diff`, runs verification, then runs QA (`workspace-daemon/src/checkpoint-builder.ts:168-255`).
   - If daemon `autoApprove` is enabled, it commits and merges worktree changes immediately before creating the checkpoint (`workspace-daemon/src/checkpoint-builder.ts:221-240`).

8. **QA**
   - QA is not a daemon-native review loop. It is a separate OpenClaw subagent call through `QARunner` (`workspace-daemon/src/checkpoint-builder.ts:145-160`, `workspace-daemon/src/qa-runner.ts:39`).
   - If QA returns `APPROVED` with confidence `>= 0.9`, checkpoint builder directly approves the checkpoint, even under nominal manual review mode (`workspace-daemon/src/checkpoint-builder.ts:154-160`).

9. **Approve / reject / revise**
   - Checkpoint routes provide the full review surface: detail, diff, verify, approve, approve+commit, approve+PR, approve+merge, reject, revise (`workspace-daemon/src/routes/checkpoints.ts:383-770`).
   - `approveCheckpoint()` in tracker completes the task run and the task (`workspace-daemon/src/tracker.ts:1759`).
   - Reject only resumes a live session if `session_id` exists and OpenClaw can be steered (`workspace-daemon/src/routes/checkpoints.ts:665-715`).
   - Revise appends reviewer notes to the task description, creates a **new pending task run**, and dispatches again (`workspace-daemon/src/routes/checkpoints.ts:717-768`).

10. **Mission complete**
   - Mission completion is derived from task states in tracker (`workspace-daemon/src/tracker.ts:922-928`, `workspace-daemon/src/tracker.ts:2309`, `workspace-daemon/src/tracker.ts:2720`).
   - There is no stronger conductor-level closed-loop control that says “decompose, implement, QA, revise until quality gate, finalize”.

### Where the Loop Breaks

- Conductor launch breaks at task creation because it uses the wrong endpoint.
- The “reply to agent” interaction is not a conversation path for Codex/Claude and not even a message path in the daemon.
- QA is opportunistic and external, not a first-class mission stage.
- `triggerQaReview()` exists in tracker but is effectively dead architecture; the real QA path is checkpoint-builder calling `QARunner` directly (`workspace-daemon/src/tracker.ts:1795-1829`).
- Auto-approve and QA-auto-approve overlap in contradictory ways.
- Suggested agent types are generated but not durably stored on tasks.

## 4. Broken Contracts

### Frontend Calls That Do Not Match the Daemon

| Frontend expectation | Actual daemon contract | Impact |
| --- | --- | --- |
| `/api/workspace-tasks` (`src/screens/gateway/hooks/use-conductor-workspace.ts:503`, `src/screens/projects/projects-screen.tsx:221`, `src/screens/projects/projects-screen.tsx:1247`, `src/screens/projects/projects-screen.tsx:1470`) | `/api/workspace/tasks` (`workspace-daemon/src/server.ts:87`) | Conductor mission launch and parts of ProjectsScreen task creation can fail outright |
| `/api/workspace/stats` (`src/screens/gateway/hooks/use-conductor-workspace.ts:665-671`, `src/screens/workspace/workspace-layout.tsx:225-229`, `src/screens/projects/projects-screen.tsx:472`) | No route | Workspace stats panes are dead or permanently erroring |
| `/api/workspace/projects/:id/files` (`src/screens/gateway/hooks/use-conductor-workspace.ts:681-690`) | No route | Conductor “Output Files” section is nonfunctional |
| `/api/workspace/daemon/restart` (`src/screens/workspace/workspace-layout.tsx:245-250`) | No route | Restart button is dead |
| `/api/workspace/task-runs/:id/message` (`src/screens/gateway/hooks/use-conductor-workspace.ts:572-586`) | No route | Conductor cannot send agent follow-up messages |
| Retry fallback with `{ message }` (`src/screens/gateway/hooks/use-conductor-workspace.ts:582-585`) | `POST /retry` ignores reviewer message semantics (`workspace-daemon/src/routes/task-runs.ts:159-191`) | “Reply to agent” silently becomes “retry failed run”, and only for failed runs |
| Per-run SSE at task-runs route implied by UI/spec expectations | JSON events at `/api/workspace/task-runs/:id/events`; SSE is actually `/api/workspace/events/:taskRunId` (`workspace-daemon/src/routes/task-runs.ts:142-149`, `workspace-daemon/src/routes/events.ts:58-81`) | Event consumers need two different contracts |

### Data Model Drift

- `suggested_agent_type` is produced by decomposition and referenced by orchestration, but task persistence does not make it durable. The type exists in tracker guidance and orchestration logic (`workspace-daemon/src/orchestrator.ts:98-104`), but task creation/update routes do not persist it and schema does not store it.
- Verification keys differ by surface. Checkpoint detail route returns `test` singular (`workspace-daemon/src/routes/checkpoints.ts:322-327`), while `project-detail-view.tsx` expects `tests` in its derived health snapshot.
- Conductor uses custom query keys under `['workspace','conductor', ...]`, while shared SSE invalidation and older screens tend to use `['workspace', ...]`. This makes freshness inconsistent even where the route exists.
- Conductor models “reply to agent” as `approveCheckpoint(action:'merge', reviewer_notes)` (`src/screens/gateway/conductor.tsx:431-447`). That is a semantic break, not just a naming issue.

## 5. Agent Interaction Model

### What Each Adapter Supports

| Adapter | Multi-turn | Streaming | Session persistence | Checkpoint compatible | Notes |
| --- | --- | --- | --- | --- | --- |
| Codex | No | Yes | No durable thread/session persisted | Yes | Fresh `thread/start` + single `turn/start` every run |
| Claude | No | Yes-ish stdout streaming | No | Yes | Pure CLI one-shot process |
| OpenClaw | Partial | Yes | Yes, `session_id` captured when available | Yes | Only adapter with an explicit steering path |

### Codex One-Shot Limitation

The Codex adapter starts a process, initializes JSON-RPC, creates a fresh thread with `persistExtendedHistory: false`, starts one turn, streams output, then tears everything down (`workspace-daemon/src/adapters/codex.ts:720-757`). It keeps `currentThreadId` and `currentTurnId` only in local memory (`workspace-daemon/src/adapters/codex.ts:248-250`, `workspace-daemon/src/adapters/codex.ts:741-756`). Nothing writes a Codex thread identifier into the DB. There is no route to resume a Codex thread, no session-owned adapter object to keep alive, and no frontend contract for continuing the thread. That is the core reason Codex runs are one-shot.

### OpenClaw Status

OpenClaw is the only adapter that behaves like a sessioned runtime:

- It calls `/sessions/spawn` with runtime `acp` for coder/daemon agents and `subagent` for planner/qa (`workspace-daemon/src/adapters/openclaw.ts:16-18`, `workspace-daemon/src/adapters/openclaw.ts:55-76`).
- It stores `session_id` into tracker whenever the upstream API returns one (`workspace-daemon/src/adapters/openclaw.ts:86-96`, `workspace-daemon/src/adapters/openclaw.ts:143-153`).
- It can be steered later by `POST /api/sessions/:id/messages` via `steerSession()` (`workspace-daemon/src/adapters/openclaw.ts:25-40`).

This is why checkpoint rejection can continue an OpenClaw run but cannot continue Codex or Claude (`workspace-daemon/src/routes/checkpoints.ts:680-705`).

### What Conversational Agents Would Require

At minimum:

1. A session-capable adapter contract, not `execute()` only.
   - Add `spawnSession()`, `sendMessage()`, `interrupt()`, `subscribe()`, `resumeSession()`, `closeSession()`.

2. Persistent run/session state.
   - Store adapter-specific session metadata on `task_runs`, not just a nullable `session_id`.
   - For Codex this means at least `thread_id`, maybe `turn_id`, adapter runtime, and session capability flags.

3. A daemon-owned messaging route.
   - `POST /api/workspace/task-runs/:id/messages` should dispatch through the active adapter abstraction, not fallback to retry.

4. A consistent run event stream contract.
   - One SSE endpoint per run, one JSON history endpoint per run, same payload shape.

5. Mission logic that understands “checkpoint rejected, continue same run” vs “checkpoint revised, spawn new run”.
   - Today this branch only exists for OpenClaw.

## 6. Workspace Screens vs Conductor

### What Workspace Screens Do That Conductor Does Not

The workspace/projects surfaces are materially broader:

- Rich checkpoint review with detail, raw diff, verification reruns, revise, reject, approve+commit, approve+PR, approve+merge (`src/screens/projects/checkpoint-detail-modal.tsx`).
- Deep project health, git status, policy display, phases/missions/task dependency waves, run history, activity timeline (`src/screens/projects/project-detail-view.tsx:369`, `src/screens/projects/project-detail-view.tsx:429`, `src/screens/projects/project-detail-view.tsx:1167`).
- Project creation with policy fields and decompose-to-plan-review flow (`src/screens/projects/new-project-wizard.tsx:359-472`, `src/screens/projects/new-project-wizard.tsx:504-529`).
- Review inbox and dashboard summaries (`dashboard-*` components).
- Mission console routing from workspace shell (`src/screens/workspace/workspace-layout.tsx:585`).

### Conductor’s Distinct Value

Conductor does a few things the workspace shell does not:

- Single-screen polished mission intake flow with four phases: `home`, `preview`, `active`, `complete`.
- More opinionated “start from a goal” experience.
- Inline active-run focus with task stream and terminal panel.

### Phase Breakdown

- `home`: hero textarea, quick actions, recent mission browser (`src/screens/gateway/conductor.tsx:718-885`).
- `preview`: decomposition review with enable/disable toggles and dependency badges (`src/screens/gateway/conductor.tsx:892-977`).
- `active`: left task list, center task detail/overview, right insights sidebar, bottom terminal workspace (`src/screens/gateway/conductor.tsx:1122-1629`).
- `complete`: sticky mission header, optional output files, checkpoints list, failure details, sidebar progress (`src/screens/gateway/conductor.tsx:983-1115`).

### Duplicate vs Complement

- Conductor **duplicates** mission launch, active monitoring, and checkpoint approval.
- Projects/workspace screens **complement** with richer review, health, history, and admin surfaces.
- Today they are not layered intentionally. They are two overlapping products hitting partly different assumptions.

### Which Features Actually Work

Likely working:

- Conductor mission status polling, checkpoint list polling, recent mission list, basic active/complete rendering when a mission already exists and the route set matches.
- Project detail, checkpoint detail modal, health and git info, review queue.

Broken or misleading:

- Conductor mission launch through manual task creation.
- Conductor output files view.
- Conductor stats view.
- Conductor “reply to agent”.
- Workspace layout stats/restart controls.
- Any UI path that assumes `/api/workspace-tasks`.

## 7. The Vision Gap

### Target Vision

Eric’s intended system is:

- user describes project
- agents plan/research/code/review in an autonomous loop
- conductor manages the loop hands-free when allowed
- quality gates stop bad work
- humans can intervene conversationally with agents mid-run
- frontend is one coherent control surface

### What Exists Today

What exists is:

- decomposition
- mission/task persistence
- dependency-aware dispatch
- one-shot task execution
- checkpoint capture
- externalized QA pass
- manual review tools in the legacy workspace screens

What does **not** exist is:

- a single authoritative conductor workflow
- a durable multi-turn run/session model across adapters
- consistent frontend/backend contracts
- a clean planner -> implementer -> QA -> revise loop managed by the daemon
- reliable “hands-free mode” semantics

The current system is overengineered in the UI layer and underengineered in the runtime contract. There are too many surfaces around too weak a session model.

## 8. Recommended Architecture

### Keep

- `Tracker` as the central persistence/event authority.
- `Orchestrator` scheduling and dependency wave logic.
- Checkpoint routes and checkpoint detail model.
- Project/worktree management for real repos.
- Project detail and checkpoint detail workspace screens as the review/admin surface.

### Rewrite

- Adapter contract.
- Conductor API layer.
- Run/session lifecycle management.
- Stats aggregation as a real daemon endpoint rather than ad hoc frontend derivation.

### Delete or Retire

- `/api/workspace-tasks` assumptions everywhere. Replace, do not alias long term.
- Conductor “reply to agent” behavior that actually approves and merges.
- Duplicate faux-control surfaces that cannot perform the actions they advertise.
- `triggerQaReview()` if checkpoint-builder-owned QA remains the architecture.

### New Components Needed

1. **Session Manager**
   - Daemon-owned abstraction for active agent sessions across Codex, Claude, OpenClaw.
   - Responsible for spawn, message, interrupt, resume, close, event fan-out.

2. **Run Messaging API**
   - `POST /api/workspace/task-runs/:id/messages`
   - `POST /api/workspace/task-runs/:id/interrupt`
   - `GET /api/workspace/task-runs/:id/events` as SSE
   - `GET /api/workspace/task-runs/:id/history` as JSON

3. **Mission State Machine**
   - Explicit phases: planned, queued, running, awaiting_review, revising, qa, approved, failed, completed.
   - Stop encoding the whole lifecycle implicitly in task status plus checkpoint status.

4. **Stats / Files / Admin endpoints**
   - Either add them for real or remove every caller.

### Should Conductor Orchestrate Through the Daemon, OpenClaw, or Hybrid?

Recommended: **hybrid, but daemon-owned**.

- The daemon should remain the orchestration authority for projects, tasks, runs, checkpoints, retries, approvals, and quality gates.
- OpenClaw should be treated as **one possible session runtime**, not the orchestration brain.
- Conductor should talk only to daemon contracts.
- The daemon may internally delegate session execution to OpenClaw, Codex, Claude, or future providers.

Do **not** make Conductor call OpenClaw sessions directly for primary orchestration. That would bypass tracker state, checkpoint flow, and mission accounting, and it would make the split-brain problem worse.

## 9. Implementation Roadmap

1. **Fix the contract drift**
   - Complexity: M
   - Replace every `/api/workspace-tasks` caller with `/api/workspace/tasks`.
   - Remove or implement `/stats`, `/projects/:id/files`, `/daemon/restart`, `/task-runs/:id/message`.

2. **Choose one authoritative frontend**
   - Complexity: M
   - Keep Projects/Workspace as the review/admin surface.
   - Keep Conductor only as mission intake + active mission cockpit, or fold it into ProjectsScreen.

3. **Introduce a real session adapter interface**
   - Complexity: XL
   - Expand adapter contract beyond `execute()`.
   - Persist adapter session metadata on `task_runs`.

4. **Make Codex conversational or explicitly one-shot**
   - Complexity: L if you declare it one-shot and model it honestly.
   - Complexity: XL if you persist and resume Codex threads.
   - Either path is fine; pretending it already supports conversation is not.

5. **Normalize run event transport**
   - Complexity: M
   - One SSE endpoint shape, one JSON history endpoint shape, one query-key strategy.

6. **Separate review actions from messaging**
   - Complexity: M
   - “Approve”, “reject”, “revise”, and “message” must be distinct user intents and distinct routes.

7. **Make quality gates explicit**
   - Complexity: L
   - Decide whether QA can auto-approve.
   - If manual review is enabled, do not let QA silently bypass it.

8. **Persist planning metadata**
   - Complexity: M
   - Add `suggested_agent_type` to schema, migrations, tracker, routes, and frontend normalizers.

9. **Rebuild Conductor on top of the stable daemon contract**
   - Complexity: L
   - Only after steps 1-8.
   - Conductor should become the opinionated user flow, not a second backend dialect.

## File-by-File Notes

### Daemon Files

- `workspace-daemon/src/server.ts`
  - Works: bootstraps daemon cleanly and mounts all implemented routers.
  - Broken/incomplete: missing routes that multiple frontends rely on; no stats/files/restart support.
  - Dependencies/data flow: `Tracker` + `Orchestrator` are created here and injected into routers.

- `workspace-daemon/src/orchestrator.ts`
  - Works: dispatch loop, retry/backoff, concurrency limiting, pause/stop.
  - Broken/incomplete: no true session lifecycle, creates git repos opportunistically, no explicit QA stage, no higher-order mission loop.
  - Dependencies/data flow: reads tasks from `Tracker`, calls `AgentRunner`, updates task/task-run/agent states, emits audit/SSE.

- `workspace-daemon/src/agent-runner.ts`
  - Works: prompt assembly, workspace prep, adapter dispatch, checkpoint handoff.
  - Broken/incomplete: strictly one adapter call per run, no mid-run interaction path, generic prompt for ephemeral Conductor projects hides agent identity.
  - Dependencies/data flow: `WorkspaceManager` -> adapter -> `buildCheckpoint()`.

- `workspace-daemon/src/tracker.ts`
  - Works: durable data model, eventing, most CRUD, checkpoint approval semantics.
  - Broken/incomplete: contains dead or weakly integrated logic like `triggerQaReview()`, type drift around `suggested_agent_type`.
  - Dependencies/data flow: all routes and orchestrator rely on it.

- `workspace-daemon/src/checkpoint-builder.ts`
  - Works: captures diffs reliably enough, stores raw diff, runs verification.
  - Broken/incomplete: QA auto-approval can override manual review expectations.
  - Dependencies/data flow: called by `AgentRunner`, stores results back through `Tracker`.

- `workspace-daemon/src/qa-runner.ts`
  - Works: can get an AI QA verdict via OpenClaw when available.
  - Broken/incomplete: external dependency, fragile parsing, not integrated as a mission-stage primitive.
  - Dependencies/data flow: only checkpoint builder uses it.

- `workspace-daemon/src/decomposer.ts`
  - Works: decomposition and fallback.
  - Broken/incomplete: forced “Clarify:” task is useful for planning but awkward for fully autonomous flows; output metadata is richer than persistence layer.
  - Dependencies/data flow: called only from decompose route.

- `workspace-daemon/src/workspace.ts`
  - Works: repo blocking and worktree creation.
  - Broken/incomplete: `/tmp/conductor-*` fallback creates detached mini-projects that are often not what the user thinks they launched.
  - Dependencies/data flow: used by `AgentRunner`.

- `workspace-daemon/src/routes/tasks.ts`
  - Works: basic list/create/update/run.
  - Broken/incomplete: omits `suggested_agent_type`; too thin for current frontend expectations.

- `workspace-daemon/src/routes/task-runs.ts`
  - Works: list, retry, pause, stop, adhoc creation.
  - Broken/incomplete: no messaging route, JSON events route collides conceptually with SSE route elsewhere.

- `workspace-daemon/src/routes/checkpoints.ts`
  - Works: richest and most coherent route set in the daemon.
  - Broken/incomplete: reject continuation only works for OpenClaw-backed sessions.

- `workspace-daemon/src/routes/decompose.ts`
  - Works: flexible decomposition entrypoint.
  - Broken/incomplete: mixes pure planning with auto-creation/start side effects.

- `workspace-daemon/src/routes/events.ts`
  - Works: workspace-wide SSE and per-run SSE.
  - Broken/incomplete: route naming is inconsistent with task-runs routes/UI expectations.

- `workspace-daemon/src/adapters/codex.ts`
  - Works: one-shot task execution with streaming deltas and auto-approved tool requests.
  - Broken/incomplete: no persistent thread/session model, no follow-up messages.

- `workspace-daemon/src/adapters/claude.ts`
  - Works: one-shot CLI execution.
  - Broken/incomplete: same conversation limitation as Codex, plus weaker structured protocol.

- `workspace-daemon/src/adapters/openclaw.ts`
  - Works: session spawn, session ID capture, later steering.
  - Broken/incomplete: still wrapped behind an `execute()` contract, so conversation is bolted on rather than modeled first-class.

### Conductor Files

- `src/screens/gateway/conductor.tsx`
  - Works: phase rendering, recent mission browsing, active task cockpit, checkpoint cards.
  - Broken/incomplete: “reply to agent” is really approve+merge; output files depend on nonexistent endpoint; only session-backed runs can show full agent panel.
  - Dependencies/data flow: entirely driven by `useConductorWorkspace()` plus shared SSE cache.

- `src/screens/gateway/hooks/use-conductor-workspace.ts`
  - Works: decomposition, mission status, checkpoints, recent missions.
  - Broken/incomplete: wrong task endpoint, nonexistent stats/files/message endpoints, inconsistent cache keys.
  - Dependencies/data flow: direct `fetch` wrapper, no shared workspace request client.

### Workspace / Projects Files

- `src/screens/workspace/workspace-layout.tsx`
  - Works: shell, tabs, config toggle, mission-console routing.
  - Broken/incomplete: stats and restart call missing daemon routes.

- `src/screens/projects/projects-screen.tsx`
  - Works: broad control plane coverage.
  - Broken/incomplete: still carries wrong `/api/workspace-tasks` contract, so some mission/task flows are brittle.

- `src/screens/projects/project-detail-view.tsx`
  - Works: best read-only and review-oriented project observability surface.
  - Broken/incomplete: some health derivation is client-side patchwork rather than canonical daemon API.

- `src/screens/projects/new-project-wizard.tsx`
  - Works: strongest project creation UX.
  - Broken/incomplete: downstream still inherits daemon/frontend contract drift.

- `src/screens/projects/checkpoint-detail-modal.tsx`
  - Works: best review UI in the codebase; matches daemon checkpoint routes closely.
  - Broken/incomplete: none significant beyond backend limitations.

- Remaining dashboard/dialog/helper files
  - Mostly working; they are support surfaces around the stronger ProjectsScreen control plane rather than the source of architectural breakage.
