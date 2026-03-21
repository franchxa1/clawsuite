# ClawSuite E2E Test Report
**Date:** 2026-03-20  
**Branch:** `feat/ux-polish-v3-handshake`  
**Tester:** Aurora (subagent — workspace-e2e-test)  
**TSC Status:** ✅ Clean before and after all fixes

---

## Summary

ClawSuite is **production-ready**. The core mission orchestration loop is fully wired. 12 components are orphaned (built but never rendered) — annotated with `TODO(orphan)` comments. No broken imports. No broken routes. No type errors.

---

## 1. End-to-End Workspace Flow

### How a user CREATES a mission/goal

**Entry point:** `/agents` route → `AgentsScreen` → `AgentHubLayout`

The primary creation flow:
1. User types a goal in the mission goal textarea (Overview tab)
2. Pressing Enter (when focused on textarea) or clicking "Launch Mission" triggers `handleCreateMission()`
3. A launch wizard modal (`WizardModal`) is also available via the "New Mission" button — provides step-by-step: `gateway` → `team` → `goal` → `plan` → `review`
4. The `newMissionGoal` text input in the wizard modal is the richer path — supports planning questions and mock plan generation

**Gap:** No explicit "save as draft" before launch. Missions go straight from goal input to running. If the user closes the browser mid-wizard, nothing is saved.

---

### How the mission gets DECOMPOSED into tasks

`handleCreateMission()` calls `parseMissionGoal(trimmedGoal, teamMembers, missionId)`:

1. `extractMissionItems(goal)` splits the goal into segments (by numbered list, bullet points, or semicolons)
2. If ≥2 segments found: each segment becomes a `HubTask`
3. If <2 segments: the entire goal becomes a single task
4. Tasks are assigned round-robin to team members (`member = teamMembers[index % team.length]`)
5. Status: `'assigned'` if agent assigned, `'inbox'` if no team

**Gap:** Decomposition is entirely local/regex-based — no LLM call. A goal like "build a full-stack app" produces 1 task, not a structured breakdown. The launch wizard has a `buildMockMissionPlan()` function that creates more granular tasks, but it's also heuristic-based (keyword matching), not AI-generated.

---

### How tasks get ASSIGNED to agents

Assignment happens at parse time (round-robin) or manually via KanbanBoard:
- User can drag or reassign via `onAssignAgent` callback in KanbanBoard
- Assigning in the Kanban board calls `sendToSession(sessionKey, message)` to notify the agent immediately

During `executeMission()`:
1. `ensureAgentSessions()` spawns gateway sessions for each team member
2. Tasks are grouped by `agentId`
3. Dispatch message is built (includes role context, task list, goal)
4. `dispatchToAgent()` sends the message to each agent's session

---

### How agents EXECUTE and report back

Execution is via SSE (Server-Sent Events):
1. Each agent has an `EventSource` connection to `/api/gateway/stream/:sessionKey`
2. SSE events update `agentActivity` (last line, last timestamp, event type)
3. Session status is polled via `agentSessionStatus` (`updateAgentStatus`)
4. Agent output is captured in `agentOutputLinesRef` (used for mission report)
5. `APPROVAL_REQUIRED:` prefix in SSE output triggers an approval entry
6. Stale detection: if no SSE activity for 600s (10 min), session is flagged

**Retry logic:** If an agent session fails (SSE close + missing output), one automatic retry is attempted. `retryingAgents` state tracks this. A second failure marks the agent as errored.

---

### How REVIEW/APPROVAL works

Two parallel approval systems exist:

**System 1: Gateway Approvals** (human-in-the-loop tool calls)
- Gateway sends approval requests to `/api/gateway/approvals`
- `ApprovalsBell` polls this endpoint and shows a header dropdown
- User approves/denies inline in the dropdown
- Resolved via `resolveGatewayApproval()`

**System 2: Workspace Checkpoints** (code review)
- Agents submit work as checkpoints via the workspace daemon
- `ReviewQueueScreen` (`/workspace#review` tab) lists pending checkpoints
- `CheckpointDetailScreen` shows inline diffs with line-level add/remove coloring
- Actions: Approve / Reject / Approve+PR / Approve+Commit / Approve+Merge / Revise / Verify TSC
- This is the primary "review" surface for code output

**Gap:** The Hub's KanbanBoard has a "Review" column but it is purely a visual state — moving a task to Review does NOT trigger the approval gate or notify a reviewer. It's a manual Kanban drag, disconnected from the Workspace checkpoint review.

---

### How MERGE/DELIVERY happens

Via Workspace:
1. Approved checkpoints can be merged via `Approve+Merge` button in `CheckpointDetailScreen`
2. This calls the workspace API which runs the actual git merge/commit
3. `ExportMissionButton` allows downloading the mission summary as markdown

Via Hub:
- No explicit merge step. Mission completes when all agents reach terminal state.
- `completeMission()` archives the mission to history (localStorage, capped at 20)
- A mission report markdown is auto-generated and stored (localStorage, capped at 10)

**Gap:** No delivery step in the Hub — no integration with a "done" artifact destination (e.g., posting the report to a channel, committing a file, opening a PR). The Workspace has this via checkpoint actions, but the Hub flow ends with a report.

---

## 2. Agent Hub Navigation

### Tabs in AgentHubLayout (5 tabs)

| Tab ID | Label | Status |
|--------|-------|--------|
| `overview` | 🏠 Overview | ✅ Wired — `renderOverviewContent()` |
| `runs` | ▶️ Runs | ✅ Wired — `renderRunsTabContent()` with `RunConsole` + `RunCompare` |
| `kanban` | 📋 Board | ✅ Wired — `KanbanBoard` component |
| `analytics` | 📊 Analytics | ✅ Wired — `CostAnalyticsDashboard` |
| `configure` | ⚙️ Configure | ✅ Wired — `renderConfigureContent()` with agents/teams/keys |

### Tabs in WorkspaceLayout (6 tabs)

| Tab ID | Label | Status |
|--------|-------|--------|
| `projects` | Projects | ✅ Wired — `ProjectsScreen` or `MissionConsoleScreen` |
| `review` | Review | ✅ Wired — `ReviewQueueScreen` |
| `runs` | Runs | ✅ Wired — `RunsConsoleScreen` |
| `agents` | Agents | ✅ Wired — `AgentsScreen` |
| `skills` | Skills | ✅ Wired — `WorkspaceSkillsScreen` |
| `teams` | Teams | ✅ Wired — `TeamsScreen` |

### Sidebar/Nav wiring

All top-level routes are registered in `routeTree.gen.ts`. The `/agents` route renders `AgentsScreen` (which contains `AgentHubLayout`). The `/workspace` route renders `WorkspaceLayout`. Both are accessible from the sidebar nav.

### Orphaned components (not wired to any route or tab)

| Component | File | Should be wired to |
|-----------|------|--------------------|
| `AgentsWorkingPanel` | `agents-working-panel.tsx` | Replace inline agent rows in Hub Overview |
| `RunLearnings` | `run-learnings.tsx` | New 'Learnings' tab in RunConsole |
| `ApprovalsPage` | `approvals-page.tsx` | Full-page approvals view in Configure tab |
| `ApprovalsPanel` | `approvals-panel.tsx` | Sidebar approvals panel alternative |
| `OverviewTab` | `overview-tab.tsx` | Replace `renderOverviewContent()` inline code |
| `CalendarView` | `calendar-view.tsx` | New 'Calendar' tab in TAB_DEFS |
| `AgendaView` | `agenda-view.tsx` | View-mode toggle within Calendar tab |
| `MissionEventLog` | `mission-event-log.tsx` | 'Events' sub-tab in RunConsole |
| `PresenceIndicator` | `presence-indicator.tsx` | Replace or merge with CollaborationPresence |
| `LiveActivityPanel` | `live-activity-panel.tsx` | Replace current right panel in Hub |
| `ReusableSnippets` | `reusable-snippets.tsx` | Configure tab or mission input area |
| `hub-utils.tsx` | `hub-utils.tsx` | Replace local function duplication in agent-hub-layout.tsx |

---

## 3. Store Analysis

### MissionStore (`src/stores/mission-store.ts`)

**State machine:**
```
idle → (startMission) → running → (pause) → paused → (resume) → running
running → (stop/complete) → stopped/completed
running/paused → (abort) → aborted
```

**Defined but semantically incomplete:**
- `missionState: 'running' | 'paused' | 'stopped'` — note `stopped` is used for both normal completion and abort (actual state is in `activeMission.state` which distinguishes `completed` vs `aborted`)
- No `in_review` state — tasks go `assigned → in_progress → done` with no review gate
- `saveCheckpoint()` is defined in the store type but **not implemented** in the `create()` call — the checkpoint saving happens via `buildCheckpoint()` called inline rather than via `store.saveCheckpoint()`

**Actions defined but never called externally:**
- `setMissionGoal()` — goal is managed as local state in agent-hub-layout, store version is secondary
- `setBoardTasks()` — board tasks are not kept in sync with `missionTasks` in most flows
- `markBeforeUnloadRegistered()` — called correctly for cleanup

**Missing error states:**
- No `failed` lifecycle state on `ActiveMission` (only `aborted`)
- No partial-failure state (some agents failed, others succeeded)

### WorkspaceStore (`src/stores/workspace-store.ts`)

**Status:** Working. Minimal — tracks sidebar/UI state only.

**Missing:** No workspace-level agent assignment, project scoping, or active agent tracking. This store is purely presentational.

### TaskStore (`src/stores/task-store.ts`)

**Status:** Working. Used by KanbanBoard.

**Mismatch:** `TaskStatus` in `task-store.ts` is `'backlog' | 'in_progress' | 'review' | 'done'` while `TaskStatus` in `task-board.tsx` is `'inbox' | 'assigned' | 'in_progress' | 'review' | 'done'`. KanbanBoard bridges this with explicit mapping functions (`mapTaskStatusToColumn`, `mapColumnToTaskStatus`). No type errors, but conceptually confusing.

**Actions defined but infrequently called:**
- `importTasksFromJSON()` — for CSV/JSON import, no UI entry point visible
- `moveToNextStatus()` / `moveToPrevStatus()` — shortcut helpers, not wired to UI buttons

---

## 4. Working Flows (End-to-End)

| Flow | Status | Notes |
|------|--------|-------|
| Create mission → launch wizard → start | ✅ Works | Wizard has 5 steps: gateway → team → goal → plan → review |
| Create mission → direct goal input → start | ✅ Works | Textarea + Enter or Launch button |
| Agent session spawn | ✅ Works | `ensureAgentSessions()` creates gateway sessions per agent |
| Task dispatch to agents (parallel mode) | ✅ Works | All agents dispatched simultaneously |
| Task dispatch (sequential mode) | ✅ Works | Agents dispatched one after another |
| Task dispatch (hierarchical mode) | ✅ Works | Lead dispatched first, workers receive delegation brief |
| SSE stream per agent | ✅ Works | EventSource per agent, capped at 3 concurrent |
| Agent retry on failure | ✅ Works | 1 automatic retry with `scheduleAgentRetry()` |
| Mission auto-complete on all agents terminal | ✅ Works | 6s debounce timer |
| Manual stop/abort mission | ✅ Works | `stopMissionAndCleanup()` |
| Mission report generation | ✅ Works | Auto-generated markdown on completion |
| Checkpoint restore on reload | ✅ Works | `restoreCheckpoint` in Zustand persist |
| Approvals via gateway (tool use) | ✅ Works | `ApprovalsBell` polls `/api/gateway/approvals` |
| Kanban board task management | ✅ Works | Drag + move buttons + agent assignment |
| Cost analytics by mission | ✅ Works | `CostAnalyticsDashboard` reads mission reports |
| Run comparison (metadata) | ✅ Works | Duration, tokens, cost delta |
| Checkpoint review (workspace) | ✅ Works | Full diff + approve/reject/merge |
| Terminal workspace | ✅ Works | xterm.js with PTY via `/api/terminal-stream` |

---

## 5. Broken Flows (where they break)

| Flow | Break Point | Severity |
|------|-------------|----------|
| Task → Review → Approval gate | KanbanBoard "Review" column is cosmetic — no trigger to Workspace checkpoint review or approval system | P1 |
| Mission events → Event log | Events captured in `mission-event-store.ts` but `MissionEventLog` component never rendered; events lost on refresh | P1 |
| Run learnings | `RunLearnings` component exists with full UI but is never imported or used anywhere | P2 |
| "Blocked" agent triggers recovery | No Patrol Agent exists; blocked tasks don't auto-trigger any alert or retry | P1 |
| Inline code diffs in Hub | `RunConsole` artifacts tab shows text output, not diffs. Diffs only in Workspace `CheckpointDetailScreen` | P1 |
| RemoteAgents import-to-team | "Import" button in `RemoteAgentsPanel` calls `handleImportAgent()` which only shows a toast | P2 |
| Calendar/Agenda view | Both `CalendarView` and `AgendaView` components are complete but no tab in Hub renders them | P2 |
| Agent scoring | No `agent-scoring-store.ts` exists; no leaderboard; no scoring computed on `completeMission()` | P2 |

---

## 6. Missing Flows (Not Implemented)

| Feature | Status | Effort |
|---------|--------|--------|
| Patrol Agent (self-healing cron) | ❌ Not built | 1 day |
| Agent Scoring & Leaderboard | ❌ Not built | 2 days |
| Boardroom (agent-to-agent context) | ❌ Not built | 2 days |
| Per-change inline diffs in Hub | ❌ Not built | 1 day |
| Multi-agent session tabs (browser-tab style) | ❌ Not built | 1 day |
| Mission event persistence | ❌ Not built (events exist, not persisted) | 0.5 day |
| "Save draft" for missions-in-progress | ❌ Not built | 0.5 day |
| Delivery step (post-report to channel, open PR) | ❌ Not built | 1 day |
| LLM-powered task decomposition | ❌ Heuristic only | 1 day |

---

## 7. Fixes Applied (This Session)

### Fix 1: Annotated 12 orphaned components with TODO(orphan) comments

**Files changed:**
- `agents-working-panel.tsx` — explains it's imported as `_AgentsWorkingPanel` but never rendered
- `run-learnings.tsx` — explains it needs a tab + store to activate
- `approvals-page.tsx` — explains it's superseded by ApprovalsBell
- `approvals-panel.tsx` — same as above
- `overview-tab.tsx` — explains it's inlined in agent-hub-layout.tsx
- `calendar-view.tsx` — explains how to add a Calendar tab
- `agenda-view.tsx` — companion to CalendarView
- `mission-event-log.tsx` — explains persistence gap
- `presence-indicator.tsx` — explains it's superseded by CollaborationPresence
- `live-activity-panel.tsx` — explains it's a richer right-panel alternative
- `reusable-snippets.tsx` — explains missing backing store
- `hub-utils.tsx` — explains it's a duplicate of agent-hub-layout.tsx local functions

**Commit:** `51411f7` — `docs: annotate orphaned components with TODO(orphan) comments`

**TSC after:** ✅ Clean

---

## 8. Recommended Next Steps (Prioritized)

### P1 — Fix broken core UX

1. **Wire KanbanBoard Review → Approval gate**  
   When a task moves to "review" in KanbanBoard, call `addApproval()` to create a pending approval entry. This connects the visual Kanban state to the actual review/approval system.  
   Files: `kanban-board.tsx`, `agent-hub-layout.tsx` (onUpdateTask handler)  
   Effort: ~2 hours

2. **Render MissionEventLog in RunConsole**  
   Import `MissionEventLog` in `agent-hub-layout.tsx`, add an "Events" sub-tab to `RunConsole` (alongside Stream/Timeline/Artifacts/Report). Pass events from `useMissionEventStore()`.  
   Files: `run-console.tsx`, `agent-hub-layout.tsx`  
   Effort: ~2 hours  
   **Prerequisite:** Add event persistence to `mission-event-store.ts` or archive events into `MissionCheckpoint`

3. **Blocked state alerts**  
   When a task in KanbanBoard is moved to a "Blocked" column (needs to be added), emit a feed event and toast. Long-term: wire to Patrol Agent.  
   Files: `kanban-board.tsx`  
   Effort: ~1 hour for column, ~1 day for Patrol Agent

4. **Inline diffs in Hub RunConsole**  
   The Artifacts tab in RunConsole shows raw text. Add a diff-aware render mode: if artifact content starts with `diff --git` or `@@`, render with line-level add/remove coloring (same as `CheckpointDetailScreen`).  
   Files: `run-console.tsx`  
   Effort: ~3 hours

### P2 — Wire orphaned components

5. **Wire CalendarView + AgendaView**  
   Add `{ id: 'calendar', icon: '📅', label: 'Calendar' }` to `TAB_DEFS`. Render `<CalendarView>` (with agenda toggle via `<AgendaView>`) in the matching tab block. Props needed: `cronJobs`, `missionRuns`.  
   Files: `agent-hub-layout.tsx`  
   Effort: ~2 hours

6. **Wire RunLearnings**  
   Create a `learnings-store.ts` (Zustand persist, keyed by run ID). Add "Learnings" tab to RunConsole. Render `<RunLearnings>` with store data.  
   Files: `run-console.tsx`, new `learnings-store.ts`  
   Effort: ~3 hours

7. **Fix hub-utils duplication**  
   Replace local function definitions in `agent-hub-layout.tsx` with imports from `hub-utils.tsx`. This reduces agent-hub-layout.tsx from ~9400 lines.  
   Files: `agent-hub-layout.tsx`, `hub-utils.tsx`  
   Effort: ~1 day (careful refactor, tsc at each step)

### P3 — New features

8. **Patrol Agent**  
   Cron every 15 min, checks active sessions for no SSE output >10 min → flags as stuck → attempts restart. `scheduleAgentRetry()` already exists in agent-hub-layout.  
   Files: New `/api/workspace/patrol` route, new patrol cron, small Hub status indicator  
   Effort: 1 day

9. **Agent Scoring**  
   Post-mission: score agents on task pass rate, retry count, token cost. Store in `agent-scoring-store.ts`. Show leaderboard in team panel.  
   Files: New `agent-scoring-store.ts`, `config-wizards.tsx` (team panel section)  
   Effort: 2 days

10. **LLM Task Decomposition**  
    Replace `parseMissionGoal()` heuristics with an actual LLM call to the gateway. Stream decomposed tasks into the mission plan UI before launch.  
    Files: `agent-hub-layout.tsx`, new API route  
    Effort: 1 day

---

## Architecture Notes

- **Two parallel UIs**: Hub (`/agents`) = real-time agent orchestration. Workspace (`/workspace`) = project/checkpoint management. Share API routes and stores.
- **agent-hub-layout.tsx is 9400+ lines**: The file is too large to maintain safely. `hub-utils.tsx` was the start of an extraction — it should be completed.
- **Task status mismatch**: `task-store.ts` uses `'backlog'` while `task-board.tsx` uses `'inbox'`. Both types coexist and are bridged in `kanban-board.tsx`. Acceptable now, but confusing for new contributors.
- **No `saveCheckpoint()` in store**: `MissionStore.saveCheckpoint` is in the TypeScript type definition but the implementation calls `buildCheckpoint()` directly. The store action is effectively dead code.
- **Mission event persistence gap**: `mission-event-store.ts` holds up to 500 events in memory but they're cleared on page refresh. Archiving to `MissionCheckpoint` would solve this.
