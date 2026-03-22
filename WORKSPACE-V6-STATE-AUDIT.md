# WORKSPACE V6 State Audit

Date: 2026-03-22

Sources reviewed:
- `WORKSPACE-V6-SPEC.md`
- `research/workspace-v6-synthesis.md`
- `research/workspace-v6-competitive-research.md`
- Requested daemon and UI files under `workspace-daemon/src/` and `src/`

## 1. Phase Completion Matrix

| Phase | Rating | Audit |
| --- | --- | --- |
| 1A. Fix API contract drift | PARTIAL | `GET /api/workspace/stats` exists in `workspace-daemon/src/routes/stats.ts`. `GET /api/workspace/projects/:id/files` exists in `workspace-daemon/src/routes/projects.ts`. `use-workspace-sse.ts` invalidates conductor-era cache keys. The old restart caller is gone. But the legacy conductor hook still exists and still calls nonexistent `POST /api/workspace/task-runs/:id/message`, so contract drift is not fully eliminated. |
| 1B. Delete dead adapters | COMPLETE | The adapter directory is gone. Execution now goes through `openclaw-client.ts` and `mission-loop.ts`. |
| 1C. Merge Conductor into Workspace | PARTIAL | `WorkspaceMissionInput` and `WorkspaceRecentMissions` are integrated into `workspace-layout.tsx` as the default workspace home. `/conductor` now redirects to `/workspace`. But `src/screens/gateway/conductor.tsx` and `src/screens/gateway/hooks/use-conductor-workspace.ts` still exist, the route still exists for redirect-only compatibility, and the merge did not produce the richer extracted review surface described in the spec. |
| 2A. Rewrite agent runner as mission loop | PARTIAL | `workspace-daemon/src/mission-loop.ts` exists, starts sessions through `OpenClawClient`, polls status, builds checkpoints, runs QA, and pages overseer. The loop is started from `server.ts` via `orchestrator.start()`. Gaps: no self-test round before checkpoint, no structured activity parsing, revision handling has a real deadlock path on QA-triggered revisions, and agent selection still mixes provider types with role intent. |
| 2B. OpenClaw session client | COMPLETE | `workspace-daemon/src/openclaw-client.ts` implements spawn, status, send, history, and system event calls directly over HTTP. |
| 2C. Persist agent type on tasks | PARTIAL | `tasks.agent_type` exists in schema and migration, task routes accept it, and task creation stores it. The main gap is semantic: current decomposition and mission launch store provider-like values (`codex`, `claude`) instead of the role-oriented values the spec expects (`planner`, `coder`, `critic`, `aurora-coder`, etc.). |
| 2D. Mission state machine | PARTIAL | `MissionStatus` now includes `decomposing`, `ready`, `reviewing`, and `revising` in `types.ts`, and tracker lifecycle methods exist. But transitions are inferred heuristically in `tracker.refreshMissionStatus()`, not modeled as explicit gates with timestamps. There is no `abandoned` state, no interrupt-before semantics, and the QA revision path can leave a mission stuck in `reviewing`. |
| 3A. Aurora as overseer | PARTIAL | Projects have `overseer` and `auto_approve` fields, mission loop pages through `systemEvent()`, and ambiguous QA / human-input cases are surfaced. But the payload is plain text, not a structured handoff, and there is no per-overseer delivery routing beyond generic system events. |
| 3B. Overseer cron job | PARTIAL | `workspace-daemon/src/routes/overseer.ts` implements `/pending` and `/notify`, and the tracker query for pending checkpoints is real. But there is no actual scheduler in the daemon, the comment still points to port `3099` while `server.ts` defaults to `3002`, and `notify` ignores the specific `item.overseer` value when sending reminders. |
| 4A. Agent role configuration | PARTIAL | `projects.agent_config` exists, normalizes in project routes, and `mission-loop.ts` can resolve configured roles from `agent_config.roles`. But the task pipeline mostly feeds provider types instead of role keys, there is no clear typed role handoff model, and the current workflow is not consistently selecting planner/coder/critic roles the way the spec describes. |
| 4B. Critic loop | PARTIAL | `mission-loop.ts` runs `runCriticReview()` before checkpoint creation and can request a revision when score `< 7`. That is real code. The gap is integration: critic review only runs for `isBuildRole(task)`, and current tasks are usually tagged with `codex`/`claude`, so most decomposed tasks will skip the critic loop entirely. |

### Phase Notes

- Revised synthesis items for later Phase 5 work are largely not present yet: no consolidated diff view, no editable planner checklist, no structured live activity feed, and no cross-surface notifications.
- The strongest completed foundation pieces are: direct OpenClaw client, daemon-started mission loop, explicit mission statuses, project `overseer` / `agent_config`, and merged workspace home.

## 2. Integration Gaps

### Does `workspace-mission-input` call the right daemon APIs?

Yes, mostly.

It calls:
- `POST /api/workspace/decompose`
- `POST /api/workspace/projects`
- `POST /api/workspace/phases`
- `POST /api/workspace/missions`
- `POST /api/workspace/tasks`
- `POST /api/workspace/missions/:id/start`

Real gaps:
- It manually recreates the plan-to-build chain instead of using the daemon's `project_id` / `mission_id`-aware decomposition flow.
- It always creates a temp project path under `/tmp/workspace-mission-*`, so the default home flow does not target a real user repo unless the user goes through project setup elsewhere.
- The review step is toggle-only. It does not support edit, reorder, revise-brief, agent role config, or required checks before launch.
- The first CTA still says `Launch Mission` while it is only planning/decomposing.

### Does the mission loop actually get started when the daemon boots?

Yes.

`workspace-daemon/src/server.ts` constructs `MissionLoop`, wraps it in `Orchestrator`, and calls `orchestrator.start()` at module load before the HTTP server begins listening.

### Does the overseer cron route actually work?

Partially.

What works:
- `routes/overseer.ts` pulls `tracker.listCheckpoints("pending")`
- It filters to checkpoints older than 10 minutes
- It joins back to the project through checkpoint metadata and requires a non-empty `project.overseer`

Gaps:
- `POST /notify` sends a generic `systemEvent()` and does not route by the specific `item.overseer` value it collected.
- There is no actual cron or interval wiring in the daemon. The route exists; the job does not.
- The inline comment says to call `localhost:3099`, but the daemon currently defaults to port `3002`.

### Is the critic loop properly integrated into `handleCompletedSession`?

Partially.

The logic is in `MissionLoop.completeRun()`, before checkpoint creation. That matches the intended placement.

The blocking gap is that critic review only runs when `isBuildRole(task)` returns true. That helper expects role-like values such as `coder`, `frontend`, `backend`, `aurora-coder`, or `aurora-daemon`. The current decomposition pipeline usually stores `codex` or `claude` in `task.agent_type`, so critic review is skipped for most normal mission tasks.

### Do the workspace screens show the new `MissionStatus` states correctly?

Mostly, but not consistently end-to-end.

What is wired:
- `WorkspaceRecentMissions` explicitly handles `decomposing`, `ready`, `reviewing`, `revising`, `paused`, `failed`, and `stopped`.
- Shared workspace status types and helpers include the new mission states.
- `MissionConsoleScreen` formats arbitrary mission statuses and renders them.

Gaps:
- `WorkspaceRecentMissions` does not actually reopen the mission console. It navigates to the project only and clears `missionId`, so "recent missions" is not a true resume path.
- The workspace home supports plan review and launch, but not the revised `Plan -> Review -> Build` UX from the synthesis doc.
- There is no dedicated cockpit showing the full lifecycle with agent hierarchy, live feed, and inline checkpoint gates.

## 3. Dead Code

### Should be deleted

- `src/screens/gateway/conductor.tsx`
  - Still present.
  - Appears unused except for its own legacy hook import.
  - The actual route is now `src/routes/conductor.tsx`, which only redirects.

- `src/screens/gateway/hooks/use-conductor-workspace.ts`
  - Still present.
  - Still contains stale assumptions, including the nonexistent `POST /api/workspace/task-runs/:id/message` call.
  - Appears only tied to the dead conductor screen.

- `workspace-daemon/src/agent-runner.ts`
  - Still present as a stub that throws `AGENT_EXECUTION_DISABLED_MESSAGE`.
  - Runtime execution has moved to `mission-loop.ts`.

### Should be cleaned up after deletion

- `src/routes/conductor.tsx`
  - Keep only if backward-compatible redirect is desired.
  - It is still registered in `src/routeTree.gen.ts`, so Conductor is not truly deleted.

- `src/hooks/use-workspace-sse.ts`
  - Still invalidates multiple `['workspace', 'conductor', ...]` query keys. That is harmless but legacy.

- `workspace-daemon/src/workspace.ts`
  - Safe fallback paths still use the `conductor-*` naming convention, and ephemeral project detection still checks `/tmp/conductor`.

- `src/hooks/use-activity-log.ts`
  - Mock entries still use `agent-runner` as a source.

- `workspace-daemon/README.md`
  - Still documents `src/agent-runner.ts` as the executor.

## 4. Missing Pieces for E2E

Target flow:
`User opens workspace -> types mission -> decomposes -> reviews tasks -> launches -> agents run -> checkpoints appear -> approve/reject -> mission completes`

### Actual trace through current code

1. Open workspace
- Works.
- `workspace-layout.tsx` shows `WorkspaceMissionInput` and `WorkspaceRecentMissions` on the default workspace home when no project is selected.

2. Type mission
- Works.
- `WorkspaceMissionInput` stores the brief locally and sends it to `POST /api/workspace/decompose`.

3. Decompose
- Works.
- `routes/decompose.ts` calls `Decomposer.decompose()` and returns task drafts with `suggested_agent_type`.

4. Review tasks
- Partially works.
- The UI can enable/disable tasks.
- It cannot edit task text, dependencies, agent role, checks, or project path.

5. Launch
- Works, but with a weak default.
- The UI creates a brand new project, phase, mission, and tasks, then starts the mission.
- The default project path is a temp path under `/tmp/workspace-mission-*`, not an existing repo.

6. Agents run
- Works in the happy path.
- `tracker.startMission()` sets mission running.
- `server.ts` has already started the loop.
- `MissionLoop.processReadyTasks()` starts ready tasks via `OpenClawClient.spawnSession()`.

7. Checkpoints appear
- Works.
- On completed runs, `MissionLoop.completeRun()` builds a checkpoint and runs QA.

8. Approve / reject / revise
- Manual review routes exist in `routes/checkpoints.ts`.
- `approve` is wired through tracker completion and can merge / commit / PR.
- `revise` creates a new pending task run and retriggers the task.

Broken links here:
- There is still no `POST /api/workspace/task-runs/:id/message`, so active steering is not wired.
- The revised Phase 5 checkpoint UX does not exist yet; review still depends on legacy checkpoint flows.
- `reject` marks the run failed; it does not create a retryable recovery path on its own.

9. Mission completes
- Works for the clean manual-approval path and clean auto-approval path.

Critical broken links:
- QA auto-revision path in `mission-loop.ts` can deadlock the mission in `reviewing`.
  - `createRevisionOrEscalate()` queues a new run but does not clear or revise the pending checkpoint.
  - `refreshMissionStatus()` then sees a pending checkpoint and keeps the mission in `reviewing`.
  - `processReadyTasks()` skips `reviewing` missions, so the queued revision never starts.
- Critic loop is effectively bypassed for normal decomposed tasks because `task.agent_type` is carrying provider values, not build-role values.
- `WorkspaceRecentMissions` does not resume an actual mission console because it drops `missionId`.
- There is no structured sub-task live feed from agent output, only last-message style run events.

## 5. Revised Phase 5 Readiness

### Are SSE events sufficient for live progress?

Not yet.

Current SSE coverage is enough for coarse updates:
- `task_run.started`
- `task_run.updated`
- `task_run.output`
- `task_run.completed`
- `checkpoint.created`
- `checkpoint.updated`
- `mission.updated`
- activity and audit events

Gaps for revised Phase 5:
- No structured activity markers are parsed from agent output.
- No file-by-file action feed exists.
- No agent hierarchy or child-session model is exposed through SSE.
- Mission loop only captures `lastMessage`; it does not stream or classify work into read/write/run/test events.

### Does the mission input component support the `Plan -> Review -> Build` flow?

Partially.

What exists:
- Step 1: freeform mission input
- Step 2: review decomposed tasks
- Step 3: start mission

What is still missing relative to the synthesis doc:
- editable checklist
- revise-brief loop
- high-level phases vs granular tasks split
- agent roster / checks / project path configuration in the planner step
- explicit `Plan It` then `Approve & Build` language

### Is there a notification system ready for cross-surface delivery?

Not really.

What exists:
- `OpenClawClient.systemEvent()` can emit a generic system event
- overseer and mission loop already call it for escalations

What is missing:
- structured notification payloads
- user-channel routing
- actionable approvals from Telegram/Discord
- webhook path back into the daemon for approval buttons
- cross-surface mission-complete summaries

## 6. Recommended Next Steps

1. Fix the mission-loop revision deadlock.
Complexity: Medium
Files:
- `workspace-daemon/src/mission-loop.ts`
- `workspace-daemon/src/tracker.ts`
Why:
- This is the highest-risk runtime bug.
- QA-requested revisions can currently stall the mission in `reviewing`.

2. Normalize task agent semantics from provider types to role types.
Complexity: Medium
Files:
- `workspace-daemon/src/decomposer.ts`
- `workspace-daemon/src/routes/decompose.ts`
- `workspace-daemon/src/routes/tasks.ts`
- `workspace-daemon/src/mission-loop.ts`
- `workspace-daemon/src/types.ts`
- `src/screens/workspace/workspace-mission-input.tsx`
Why:
- `agent_type` currently carries `codex` / `claude` style values.
- That blocks correct role mapping and silently disables the critic loop for normal missions.

3. Finish the Conductor deletion pass.
Complexity: Small
Files:
- `src/screens/gateway/conductor.tsx`
- `src/screens/gateway/hooks/use-conductor-workspace.ts`
- `src/routes/conductor.tsx`
- `src/hooks/use-workspace-sse.ts`
- `workspace-daemon/src/workspace.ts`
- `workspace-daemon/src/agent-runner.ts`
- `workspace-daemon/README.md`
Why:
- The old surface is dead weight and still carries stale API assumptions.

4. Upgrade workspace mission input from toggle-review to real planner review.
Complexity: Medium
Files:
- `src/screens/workspace/workspace-mission-input.tsx`
- `src/screens/workspace/workspace-layout.tsx`
- `src/screens/projects/lib/workspace-types.ts`
Why:
- The current flow is functional but not yet the revised Phase 5 planner UX.
- Add edit/revise/configure controls before mission start.

5. Add steer messaging for active task runs.
Complexity: Medium
Files:
- `workspace-daemon/src/routes/task-runs.ts`
- `workspace-daemon/src/mission-loop.ts`
- `workspace-daemon/src/openclaw-client.ts`
- `src/screens/missions/mission-console-screen.tsx`
Why:
- The spec explicitly deferred `/task-runs/:id/message`; the old conductor hook still expects it.
- This is required for live redirect/steer behavior.

6. Make recent missions resume the actual mission console.
Complexity: Small
Files:
- `src/screens/workspace/workspace-recent-missions.tsx`
- `src/screens/workspace/workspace-layout.tsx`
Why:
- The current "recent missions" list loses `missionId`, so resume is incomplete.

7. Wire a real overseer scheduler and target the actual overseer.
Complexity: Small
Files:
- `workspace-daemon/src/server.ts`
- `workspace-daemon/src/routes/overseer.ts`
- `workspace-daemon/src/openclaw-client.ts`
Why:
- The route exists, but the cron job does not.
- Reminder delivery should include the intended overseer target.

8. Build the Phase 5 live mission monitor foundation.
Complexity: Large
Files:
- `workspace-daemon/src/mission-loop.ts`
- `src/screens/missions/mission-console-screen.tsx`
- `src/hooks/use-workspace-sse.ts`
- `workspace-daemon/src/types.ts`
Why:
- Add structured activity events, richer session progress, and a cockpit-style monitor.
- This is the main prerequisite for revised Phase 5A and 5D.

## Bottom Line

Workspace V6 is no longer speculative. The core daemon loop, direct OpenClaw integration, checkpoint flow, overseer fields, and merged workspace home are real.

But the current system is still in a Phase 2/4 partial state, not Phase 5-ready:
- mission loop exists, but revision handling needs repair
- critic loop exists, but current task typing bypasses it
- Conductor is merged visually, but not fully deleted
- overseer reminders exist, but not as a real scheduled or targeted system
- the revised planner/cockpit/notification layer is still missing

If this audit is driving the overnight build, the right order is:
1. fix mission-loop correctness
2. normalize role-based task typing
3. delete legacy conductor/agent-runner residue
4. then build Phase 5 UI on top of stable runtime behavior
