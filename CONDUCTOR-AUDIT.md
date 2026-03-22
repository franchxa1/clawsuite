# Conductor Audit

Scope reviewed in full:
- `src/screens/gateway/conductor.tsx`
- `src/screens/gateway/hooks/use-conductor-workspace.ts`
- `CONDUCTOR-MERGE-SPEC.md`
- `workspace-daemon/src/routes/checkpoints.ts`
- `workspace-daemon/src/routes/missions.ts`

Additional daemon/client files checked where needed to verify feature wiring:
- `src/hooks/use-workspace-sse.ts`
- `workspace-daemon/src/routes/task-runs.ts`
- `workspace-daemon/src/routes/projects.ts`
- `workspace-daemon/src/routes/agents.ts`
- `workspace-daemon/src/routes/tasks.ts`
- `workspace-daemon/src/routes/decompose.ts`

Overall verdict: Conductor is partially wired to the Workspace daemon and the happy path works, but the screen still drops a large amount of daemon capability on the floor. The biggest problems are navigation dead-ends, incorrect output-file prioritization, stale mission metadata, and loss of backend planning data during launch.

## 1. UX Issues

### Confirmed issues

- No non-destructive way back from active mission view.
  - `src/screens/gateway/conductor.tsx:279-284` defines `handleBackToHome()`, and it always calls `workspace.stopMission.mutateAsync(activeMissionId)` before resetting local state.
  - `src/screens/gateway/conductor.tsx:977-983` wires the active-phase header button to that destructive handler.
  - Result: the user cannot simply leave the screen. "Back to Home" is actually "Stop mission and clear state".

- No back button / navigation when viewing a completed mission.
  - Complete phase only renders a bottom `New Mission` CTA at `src/screens/gateway/conductor.tsx:858-864`.
  - There is no header breadcrumb, no "Back to missions", and no sticky action area.
  - On long output/checkpoint lists the user is effectively stranded until they scroll to the bottom.

- "New Mission" is buried at the bottom of the complete screen.
  - The only launch-reset control is after output files, checkpoints, and failure details at `src/screens/gateway/conductor.tsx:858-864`.
  - This is exactly the wrong placement for the primary next action after completion.

- No way to return to mission list from active or complete phase without scrolling / resetting.
  - Active phase has only destructive `Back to Home` and a right-rail `New Mission` that hard-clears mission state at `src/screens/gateway/conductor.tsx:1295-1302`.
  - Complete phase has only bottom `New Mission`.
  - There is no sticky header/nav that preserves mission state while letting the user browse elsewhere.

- Mission status can remain stale in the home "Recent Missions" list.
  - `src/screens/gateway/hooks/use-conductor-workspace.ts:603-608` uses query key `['workspace', 'conductor', 'recent-missions']`.
  - `src/hooks/use-workspace-sse.ts:210-218` invalidates `['workspace', 'missions']` on `mission.updated`, not the Conductor-specific key.
  - Since `recentMissionsQuery` only refetches every 30s, completed missions can continue showing `running` until the next poll.
  - This is the most likely cause of "Mission status shows running for completed missions".

- Conductor has no explicit loading/error state for invalid or stale `activeMissionId`.
  - Phase selection at `src/screens/gateway/conductor.tsx:187-194` uses local mission ID plus mission status. If a saved mission ID is invalid or the daemon fails, the UI falls into active mode with empty task state instead of showing an error or returning home.

### Additional UX defects not in the prompt

- The active layout is desktop-only.
  - `src/screens/gateway/conductor.tsx:916` hardcodes a three-column grid with fixed side widths and no mobile variant.
  - On narrow viewports the left rail, center stream, and right rail will fight each other.

- The preview phase drops planner semantics.
  - It displays only `title`, `description`, and `agent` chips at `src/screens/gateway/conductor.tsx:530-556`.
  - Dependencies, estimated effort, and plan structure are not shown at all, even though the daemon spec expects richer decomposition.

## 2. Output Preview Issues

### Confirmed issues

- React/Vite apps cannot preview in iframe.
  - `src/screens/gateway/conductor.tsx:630-632` marks HTML with `type="module"` as app shell.
  - `src/screens/gateway/conductor.tsx:711-723` then renders only "App shell — requires build to preview".
  - This avoids a blank iframe, but there is no fallback source prioritization, no build action, and no project-type-specific preview guidance.

- Main component detection is too broad and prioritizes the wrong files.
  - `src/screens/gateway/conductor.tsx:703-705` treats any `page|home|app|index|main.(tsx|jsx)` file as "Main component".
  - Because files are rendered in incoming order with no sort, `main.tsx` can appear before `pages/home.tsx` and get equal visual emphasis.
  - This matches the reported behavior where boilerplate `main.tsx` outranks actual app content.

- File list is not sorted meaningfully.
  - `visibleProjectFiles` at `src/screens/gateway/conductor.tsx:313-315` only filters out `.workspace`.
  - Rendering at `src/screens/gateway/conductor.tsx:625-784` preserves backend order.
  - There is no priority sort for pages/components/app source, no grouping, and no demotion of config/app-shell files.

- No "build and preview" path exists for app-shell projects.
  - Complete phase provides `Open Preview` only for standalone HTML at `src/screens/gateway/conductor.tsx:674-680`.
  - App-shell HTML gets a dead-end notice at `src/screens/gateway/conductor.tsx:711-723`.
  - The daemon exposes project paths, and Conductor already embeds a terminal, but there is no preview workflow for buildable React apps.

### Recommended file priority

The current regex should be replaced with explicit ranking:
- `pages/**/*.tsx`
- `src/pages/**/*.tsx`
- `components/**/*.tsx`
- `src/components/**/*.tsx`
- `app.tsx` / `App.tsx`
- `index.tsx`
- `main.tsx`
- config / shell / lockfiles

### Additional preview defects

- "Main component" is a label only, not a single selected primary artifact.
  - Multiple files can satisfy `isMainSource`, so the screen may expand several "main" files at once.

- Source mode is only implemented for standalone HTML.
  - For app-shell or TSX output there is no preview/source toggle. Non-main files remain collapsed `<details>`.

- Complete phase lacks a project-type detector.
  - Conductor could infer React/Vite/Next/plain HTML from the file tree, but currently treats all output as a flat file list.

## 3. Workspace Features NOT Wired into Conductor

Below is the delta between daemon capability and what Conductor actually uses.

### Checkpoint detail, verification, and revision flows

- Raw checkpoint detail is not used.
  - Daemon: `workspace-daemon/src/routes/checkpoints.ts:364-372` returns full checkpoint detail.
  - That detail includes file diffs, verification map, and run events from `buildCheckpointDetail()`.
  - Conductor never calls `GET /api/workspace/checkpoints/:id`; it only calls diff via `getWorkspaceCheckpointDiff()`.

- Checkpoint diff viewing is partially wired.
  - Active phase expandable diff UI exists at `src/screens/gateway/conductor.tsx:1126-1200`.
  - Complete phase checkpoint UI at `src/screens/gateway/conductor.tsx:792-839` has no expand action, no diff, no file list, and no verification display.
  - So the answer is: yes, diff expansion works in active phase, but only as raw unified diff; the full detail route is unused.

- Checkpoint revise flow is not wired.
  - Daemon route exists at `workspace-daemon/src/routes/checkpoints.ts:676-720`.
  - Conductor offers approve, merge, PR, and reject only.
  - There is no "Revise" button, no reviewer note UI, and no revision resubmission flow.

- Checkpoint verification is not wired.
  - Daemon exposes `POST /:id/verify-tsc` at `workspace-daemon/src/routes/checkpoints.ts:385-406`.
  - Daemon exposes full verification at `workspace-daemon/src/routes/checkpoints.ts:408-433`.
  - Conductor never calls either endpoint and never renders stored verification state.

- Commit-only approval is not wired.
  - Daemon supports `approve-and-commit` at `workspace-daemon/src/routes/checkpoints.ts:476-509`.
  - Hook supports `action: 'commit'` at `src/screens/gateway/hooks/use-conductor-workspace.ts:530-540`.
  - Conductor never renders a button for it.

- Reviewer notes are not wired anywhere.
  - Checkpoint approve/reject/revise routes all accept reviewer notes.
  - Conductor does not provide an input for reviewer notes on any checkpoint action.

### Run events and live output

- Task run event history is not wired.
  - Daemon route exists at `workspace-daemon/src/routes/task-runs.ts:136-143`.
  - SSE already invalidates `['workspace', 'task-runs', runId, 'events']` at `src/hooks/use-workspace-sse.ts:147-149`.
  - Conductor never issues the matching query, so the invalidation is wasted and no event timeline is rendered.

- Live output rendering is partial and lossy.
  - SSE stores only the last 12 output lines per run at `src/hooks/use-workspace-sse.ts:139-144`.
  - Conductor further trims to 8 lines for running runs only at `src/screens/gateway/conductor.tsx:320-333`.
  - Once a run leaves `running|active`, its cached lines are no longer included in `liveOutputByRunId`.
  - Result: active snippets can appear, but completed-task output is easy to lose and there is no durable run log in Conductor itself.

- Per-run controls are mostly not surfaced.
  - Hook exposes `stopTaskRun` and `retryTaskRun` at `src/screens/gateway/hooks/use-conductor-workspace.ts:510-527` and `702-703`.
  - Daemon supports run pause/stop/retry at `workspace-daemon/src/routes/task-runs.ts:153-204`.
  - Conductor does not show per-task-run pause/stop/retry actions anywhere.

- `taskRunsQuery` appears miswired.
  - Hook requests `/api/workspace/task-runs?mission_id=...` at `src/screens/gateway/hooks/use-conductor-workspace.ts:573-576`.
  - Backend route only reads `project_id` at `workspace-daemon/src/routes/task-runs.ts:131-133`.
  - That means the mission filter is ignored, and Conductor may be reading task runs outside the current mission.
  - This is a real audit finding, not just missing wiring.

### Agent selection and planner metadata

- Named agent selection is not wired.
  - Daemon agent directory exists at `workspace-daemon/src/routes/agents.ts:8-24`.
  - Decompose output can carry agent suggestions.
  - Conductor preview shows a passive chip only at `src/screens/gateway/conductor.tsx:553`.
  - During launch, Conductor sends `suggested_agent_type` to `/api/workspace-tasks` at `src/screens/gateway/hooks/use-conductor-workspace.ts:663-671`, but the tasks route accepts `agent_id`, not `suggested_agent_type`, at `workspace-daemon/src/routes/tasks.ts:15-49`.
  - Net effect: suggested agents are displayed but not persisted, and actual run assignment falls back to backend auto-selection.

- Task dependencies are dropped.
  - Decomposer produces `depends_on` and `suggested_agent_type`.
  - `parseDecomposeResult()` only keeps `title`, `description`, `agent` at `src/screens/gateway/hooks/use-conductor-workspace.ts:177-194`.
  - `launchMission()` then creates tasks without `depends_on` at `src/screens/gateway/hooks/use-conductor-workspace.ts:663-671`.
  - Backend tasks route and scheduler support dependencies at `workspace-daemon/src/routes/tasks.ts:16-49`.
  - This means Conductor throws away planner sequencing before the mission starts.

### Project/workspace capabilities not surfaced

- Per-project `WORKFLOW.md` configuration is not surfaced.
  - The daemon reads `WORKFLOW.md` and project workflow config in orchestrator/workspace code.
  - Conductor does not show workflow defaults, adapter defaults, allowed tools, or required checks from project config.

- Project verification / health is not surfaced.
  - Daemon exposes `GET /projects/:id/health` at `workspace-daemon/src/routes/projects.ts:140-165`.
  - Conductor never queries or displays project health, required checks, or verification summaries.

- Project git status is not surfaced.
  - Daemon exposes git metadata on `GET /projects/:id` at `workspace-daemon/src/routes/projects.ts:125-135` and `GET /projects/:id/git-status` at `167-175`.
  - Conductor shows only `projectPath` in complete phase at `src/screens/gateway/conductor.tsx:616-618`.

- Mission history with project context is underused.
  - Recent mission query parses only mission rows at `src/screens/gateway/hooks/use-conductor-workspace.ts:319-340`.
  - Home UI shows mission name, status, and relative time only at `src/screens/gateway/conductor.tsx:480-503`.
  - No project name/path/branch/phase context is displayed.

- Stats query is fetched but unused.
  - Hook fetches `/api/workspace/stats` at `src/screens/gateway/hooks/use-conductor-workspace.ts:595-600`.
  - `conductor.tsx` never reads `workspace.stats.data`.

- Project creation settings are ignored.
  - Daemon project creation supports `spec`, `auto_approve`, `max_concurrent`, `required_checks`, and `allowed_tools` at `workspace-daemon/src/routes/projects.ts:58-121`.
  - Conductor creates projects with name/path only at `src/screens/gateway/hooks/use-conductor-workspace.ts:640-643`.

## 4. Layout / Flow Issues

### Home phase

- Home phase is the strongest part of the screen.
  - Mission input card works.
  - Recent mission pagination is implemented.
  - Quick actions are usable.
  - The main gap is stale mission status due to the SSE/query-key mismatch.

### Preview phase

- Preview phase works structurally, but it is too shallow.
  - It confirms decomposition and allows per-task enable/disable.
  - It does not show dependencies, effort, or meaningful agent assignment controls.
  - For decomposer output with a single task, the phase is functionally fine but adds little value.

### Active phase

- Active phase layout is information-dense but not robust.
  - Live output can render, but only as a short rolling snippet.
  - There is no persistent run event timeline, no per-run controls, and no safe back navigation.
  - The three-column fixed grid is not mobile-safe.

- Checkpoint review is better in active phase than complete phase.
  - Diff expansion exists and approve/PR/reject actions are present.
  - However, full checkpoint detail, reviewer notes, revise, and verification are still missing.

### Complete phase

- Complete phase ordering is wrong for post-mission behavior.
  - The header is not sticky.
  - Primary navigation is absent.
  - Output files dominate the top of the page even though many users will want: status summary, next action, checkpoint review, then artifacts.

- Mobile behavior is questionable.
  - Layout flips to one column only at `lg`, but sidebar content simply moves below the main pane without any sticky nav or shortcut actions.
  - With long output sections, the action controls are still too far away.

## 5. Recommended Fixes (Priority Ordered)

### P0: Fix destructive navigation and post-completion dead-ends

- `src/screens/gateway/conductor.tsx:279-284`
  - Split `handleBackToHome()` into:
  - `handleLeaveMissionView()` that only clears local selection and active mission pointers.
  - `handleStopMission()` that explicitly stops the mission and then clears state.
  - Rename the current header button from `Back to Home` to `Leave Mission View`, and add a separate destructive `Stop Mission`.

- `src/screens/gateway/conductor.tsx:595-900`
  - Add a sticky complete-phase header with:
  - `Back to Missions`
  - `New Mission`
  - mission status summary
  - optional project path / branch badge
  - Keep these actions visible without scroll.

- `src/screens/gateway/conductor.tsx:1292-1302`
  - Move `New Mission` into the active header and/or make the right-rail controls sticky.
  - Ensure this action does not silently stop a running mission unless the user confirms.

### P0: Preserve planner output instead of discarding it

- `src/screens/gateway/hooks/use-conductor-workspace.ts:28-34`
  - Extend the `DecomposeResult` task type to include `depends_on?: string[]` and `suggested_agent_type?: string | null`.

- `src/screens/gateway/hooks/use-conductor-workspace.ts:177-194`
  - Update `parseDecomposeResult()` to parse and retain:
  - `depends_on`
  - `suggested_agent_type`
  - optional `estimated_minutes` if present

- `src/screens/gateway/conductor.tsx:28-33`
  - Expand local `DecomposedTask` to include dependency metadata.

- `src/screens/gateway/conductor.tsx:530-556`
  - Show dependency badges and selected agent info in preview.

- `src/screens/gateway/hooks/use-conductor-workspace.ts:663-671`
  - Stop sending `suggested_agent_type` to `/api/workspace-tasks` as an ignored field.
  - Either:
  - map selected agent to a real `agent_id` after fetching `/api/workspace/agents`, or
  - change the task creation path/server contract to explicitly accept and persist `suggested_agent_type`.
  - Also send `depends_on` when creating tasks.

### P0: Fix stale mission/task-run data

- `src/hooks/use-workspace-sse.ts:210-218`
  - Also invalidate `['workspace', 'conductor', 'recent-missions']` on `mission.updated`.

- `src/hooks/use-workspace-sse.ts:152-163`
  - Also invalidate `['workspace', 'conductor', 'mission-status']`, `['workspace', 'conductor', 'task-runs']`, and `['workspace', 'conductor', 'checkpoints']` to match Conductor’s actual keys.

- `src/screens/gateway/hooks/use-conductor-workspace.ts:569-580`
  - Fix `taskRunsQuery`.
  - Either query by `project_id` if that is the supported backend filter, or update `workspace-daemon/src/routes/task-runs.ts:131-133` to accept `mission_id` and filter properly.
  - Right now the hook/backend contract is inconsistent.

### P1: Fix output file prioritization and preview behavior

- `src/screens/gateway/conductor.tsx:313-315`
  - Replace `visibleProjectFiles` with a sorted list derived from a deterministic ranking function.
  - Sort order should be:
  - `pages/**/*.tsx`
  - `src/pages/**/*.tsx`
  - `components/**/*.tsx`
  - `src/components/**/*.tsx`
  - `app.tsx` / `App.tsx`
  - `index.tsx`
  - `main.tsx`
  - standalone HTML
  - config files

- `src/screens/gateway/conductor.tsx:703-705`
  - Remove the regex-only `isMainSource` heuristic.
  - Replace it with `getFilePriority(file.relativePath)` and a single "Primary source" pick.
  - Label only the highest-ranked file as primary.

- `src/screens/gateway/conductor.tsx:711-723`
  - For app-shell HTML, provide:
  - `View source`
  - `Open primary source file`
  - `Build & Preview` action if the project appears to be React/Vite
  - clear explanation of why iframe preview is unavailable

- `src/screens/gateway/conductor.tsx:625-784`
  - Add grouping:
  - Primary source
  - App structure
  - Config/build files
  - Assets / other

### P1: Surface checkpoint detail instead of raw diff only

- `src/screens/gateway/hooks/use-conductor-workspace.ts`
  - Add queries/mutations for:
  - `GET /api/workspace/checkpoints/:id`
  - `POST /api/workspace/checkpoints/:id/verify`
  - `POST /api/workspace/checkpoints/:id/verify-tsc`
  - `POST /api/workspace/checkpoints/:id/revise`

- `src/screens/gateway/conductor.tsx:1126-1200`
  - Replace raw diff-only expansion with a detail panel that renders:
  - changed files
  - verification results
  - run events
  - reviewer notes textarea
  - actions: approve, approve+commit, approve+merge, open PR, reject, revise

- `src/screens/gateway/conductor.tsx:792-839`
  - Bring the same checkpoint detail UX to complete phase instead of summary rows only.

### P1: Improve live output and run inspection

- `src/screens/gateway/hooks/use-conductor-workspace.ts`
  - Add a `taskRunEvents` query for `/api/workspace/task-runs/:id/events`.

- `src/screens/gateway/conductor.tsx:320-333`
  - Stop deriving `liveOutputByRunId` from only `runningRuns`.
  - Preserve recent output for completed/failed runs while the mission page is open.

- `src/screens/gateway/conductor.tsx:1015-1089`
  - Add per-run controls in task detail:
  - pause run
  - stop run
  - retry failed run
  - view event timeline

### P2: Surface project context and daemon features already available

- `src/screens/gateway/hooks/use-conductor-workspace.ts`
  - Add project detail query for `/api/workspace/projects/:id`.
  - Add project health query for `/api/workspace/projects/:id/health`.
  - Add agents query for `/api/workspace/agents`.

- `src/screens/gateway/conductor.tsx`
  - Show project branch / latest commit / git status in complete and active headers.
  - Show health/verification summary in the right rail.
  - Show mission history entries with project context on home.
  - Expose agent selection in preview if the product wants user-controlled routing.

### P2: Fix responsive layout

- `src/screens/gateway/conductor.tsx:916`
  - Replace the fixed three-column grid with responsive breakpoints.
  - On mobile/tablet:
  - collapse the left task list into a drawer or horizontal tab strip
  - collapse the right rail into sections below the main content
  - keep mission controls in a sticky top bar

## Highest-risk implementation bugs found during audit

- `taskRunsQuery` sends `mission_id` but backend only supports `project_id`.
  - Files:
  - `src/screens/gateway/hooks/use-conductor-workspace.ts:573-576`
  - `workspace-daemon/src/routes/task-runs.ts:131-133`
  - Impact: incorrect run list, wrong output, wrong failures, wrong agent labels.

- Mission status on the home screen can stay stale because Conductor’s recent-missions key is never invalidated by SSE.
  - Files:
  - `src/screens/gateway/hooks/use-conductor-workspace.ts:603-608`
  - `src/hooks/use-workspace-sse.ts:210-218`
  - Impact: completed missions can still look `running`.

- Suggested agent metadata is shown in preview but not actually used when creating tasks.
  - Files:
  - `src/screens/gateway/hooks/use-conductor-workspace.ts:177-194`
  - `src/screens/gateway/hooks/use-conductor-workspace.ts:663-671`
  - `workspace-daemon/src/routes/tasks.ts:15-49`
  - Impact: misleading UI and unpredictable agent assignment.

- Dependency data from decomposition is dropped before launch.
  - Files:
  - `workspace-daemon/src/routes/decompose.ts:38-58`
  - `src/screens/gateway/hooks/use-conductor-workspace.ts:177-194`
  - `src/screens/gateway/hooks/use-conductor-workspace.ts:663-671`
  - Impact: daemon scheduler cannot honor intended ordering from the planner.

## Bottom line

Conductor is not just missing polish. It is currently flattening daemon features into a simpler UI model and, in a few places, actively losing backend intent. The most important fixes are:
- make navigation non-destructive
- repair stale data/query-key mismatches
- preserve planner dependencies/agent intent during launch
- replace regex-based output selection with explicit file ranking
- use full checkpoint detail/verification/revise flows instead of raw diff only
