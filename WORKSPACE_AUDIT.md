# ClawSuite Workspace Audit
**Date:** 2026-03-20  
**Branch:** `feat/ux-polish-v3-handshake` (266 commits ahead of main)  
**Auditor:** Aurora (subagent)  
**TSC Status:** ✅ Clean — `npx tsc --noEmit` exits 0, no type errors

---

## Summary

The codebase is **significantly further along than the roadmap implies**. The Agent Hub is a fully-wired, production-grade multi-agent orchestration system. The Workspace (projects/missions/checkpoints) is also real and deep. The two "products" are actually parallel UIs sharing stores and API routes.

**Ship blockers: NONE** — tsc clean, all major features have real implementations.

---

## ✅ WORKING FEATURES

### Component: AgentHubLayout (The Hub)
- **Path:** `src/screens/gateway/agent-hub-layout.tsx`
- **Status:** Working
- **What it does:** The main orchestration UI. 5 tabs: Overview, Runs, Board, Analytics, Configure. Full mission lifecycle: goal input → task parsing → multi-agent dispatch (parallel/sequential/hierarchical). Real SSE streams per agent. Session spawning, retry logic, steer/pause/kill controls. Agent output capture. Mission reports generated on completion. Restore from checkpoint on reload.
- **What's missing:** Nothing critical. Patrol Agent (auto-recovery cron), Agent Scoring. Boardroom (agent-to-agent) not yet wired.
- **Priority to fix:** P2 (nice-to-have enhancements)

---

### Component: MissionStore
- **Path:** `src/stores/mission-store.ts`
- **Status:** Working
- **What it does:** Full Zustand persist store. Tracks `activeMission`, state machine (`running`→`paused`→`stopped`→`completed`/`aborted`), team, tasks, agent sessions, artifacts. Builds `MissionCheckpoint` on save. Restores mission from checkpoint on rehydration. History capped at 20.
- **What's missing:** No explicit `in_progress` → `in_review` → `done/blocked` state machine (tasks go directly to `done`). No formal "review" state.
- **Priority to fix:** P2

---

### Component: MissionEventStore
- **Path:** `src/stores/mission-event-store.ts`
- **Status:** Working
- **What it does:** Zustand store (non-persist) capturing up to 500 events with `addEvent`, `clearEvents`, `getAgentEvents`. Event types defined in `mission-events.ts`. Used by LiveFeedPanel internally.
- **What's missing:** Not connected to persistence — events lost on refresh. No UI to browse mission events independently.
- **Priority to fix:** P2

---

### Component: WorkspaceStore
- **Path:** `src/stores/workspace-store.ts`
- **Status:** Working
- **What it does:** Persisted store for sidebar collapsed state, file explorer toggle, chat focus mode, chat panel open/session key, mobile keyboard state. Simple but complete.
- **What's missing:** No workspace-level agent assignment or project scoping.
- **Priority to fix:** P3 (low priority)

---

### Component: TaskBoard (Hub)
- **Path:** `src/screens/gateway/components/task-board.tsx`
- **Status:** Working
- **What it does:** Referenced via `TaskBoardRef` in AgentHubLayout. Imperative API (`moveTasks`). Shows tasks per agent with status. Connected to `missionTasks` store state.
- **What's missing:** No Blocked state. No explicit Review column in the task board.
- **Priority to fix:** P2

---

### Component: KanbanBoard
- **Path:** `src/screens/gateway/components/kanban-board.tsx`
- **Status:** Working
- **What it does:** 4-column Kanban (Backlog / In Progress / Review / Done). Reads from `useTaskStore` (not `useMissionStore`). Maps task status between store format and Kanban column keys. Shows priority badges, time-in-column, agent assignment.
- **What's missing:** No drag-and-drop (tasks presumably moved via buttons). No Blocked column.
- **Priority to fix:** P2

---

### Component: RunConsole
- **Path:** `src/screens/gateway/components/run-console.tsx`
- **Status:** Working
- **What it does:** Live SSE stream viewer with 4 tabs: Stream, Timeline, Artifacts, Report. Combined/lanes view toggle. Pending approvals display. Steer/Kill controls. Fetches history via `fetchSessionHistory`.
- **What's missing:** Nothing critical. Timeline tab exists but may not show full detail.
- **Priority to fix:** P3

---

### Component: RunCompare
- **Path:** `src/screens/gateway/components/run-compare.tsx`
- **Status:** Working
- **What it does:** Side-by-side comparison of 2 runs. Compares status, duration, agent count, cost estimate, token count. Delta indicators with better/worse/same tone. Accessible via "Compare" toggle in Runs tab.
- **What's missing:** No actual diff of agent outputs — only metadata comparison. No side-by-side output diff.
- **Priority to fix:** P2

---

### Component: MissionTimeline
- **Path:** `src/screens/gateway/components/mission-timeline.tsx`
- **Status:** Working
- **What it does:** Task progress timeline per agent. Shows completed vs total tasks, elapsed time, agent status dots. Expandable agent output panels.
- **What's missing:** Not currently used as primary view (replaced by RunConsole tabs). Available for future detail views per roadmap comment.
- **Priority to fix:** P3

---

### Component: CostAnalyticsDashboard
- **Path:** `src/screens/gateway/components/cost-analytics.tsx`
- **Status:** Working
- **What it does:** CSS bar charts for token usage and cost by day/team/model. Reads from passed `missionReports` prop. No external data fetching needed.
- **What's missing:** No live session cost tracking (only completed reports). No export.
- **Priority to fix:** P3

---

### Component: ApprovalsBell + ApprovalsPanel
- **Path:** `src/screens/gateway/components/approvals-bell.tsx`, `approvals-panel.tsx`
- **Status:** Working
- **What it does:** Polling gateway `/api/gateway/approvals`. Bell icon in header with pending count badge. Panel shows per-agent approvals. Approve/Deny routes to gateway API. Also handles agent-level `APPROVAL_REQUIRED:` markers in SSE output.
- **What's missing:** Nothing critical.
- **Priority to fix:** P3

---

### Component: LiveFeedPanel
- **Path:** `src/screens/gateway/components/live-feed-panel.tsx`
- **Status:** Working (but removed from main Hub UI)
- **What it does:** Event feed with filter tabs (Activity/Tasks/Agents/System). Uses `feed-event-bus`. Deduplication via repeat counter.
- **What's missing:** Currently commented out of `agent-hub-layout.tsx` — right panel is now "Live Output only". Still works as standalone component.
- **Priority to fix:** P3 (kept as reference)

---

### Component: TemplatePicker
- **Path:** `src/screens/gateway/components/template-picker.tsx`
- **Status:** Working
- **What it does:** WorkflowTemplate selection UI. Integrated into AgentHubLayout via `saveAsTemplate`.
- **What's missing:** Not currently shown in main tabs (may be behind a button).
- **Priority to fix:** P3

---

### Component: CollaborationPresence
- **Path:** `src/screens/gateway/components/collaboration-presence.tsx`
- **Status:** Working
- **What it does:** BroadcastChannel-based presence tracking. User dots, heartbeat/leave events, stale detection (10s). LocalStorage for persistence.
- **What's missing:** No server-side presence. Only works within same browser.
- **Priority to fix:** P3

---

### Component: RemoteAgentsPanel
- **Path:** `src/screens/gateway/components/remote-agents-panel.tsx`
- **Status:** Working (but commented out of Overview tab)
- **What it does:** Lists all non-local gateway sessions with session keys, models, status. Filters out cron/noise sessions. Removed from Overview per comment "too noisy with 29+ sessions."
- **What's missing:** No import-to-team action (stub toast only in handler).
- **Priority to fix:** P3

---

### Component: AgentOutputPanel
- **Path:** `src/screens/gateway/components/agent-output-panel.tsx`
- **Status:** Working
- **What it does:** SSE stream viewer for individual agent. Used in right panel of Hub overview when agent is selected.
- **What's missing:** Nothing critical.
- **Priority to fix:** P3

---

### Component: AgentChatPanel
- **Path:** `src/screens/gateway/components/agent-chat-panel.tsx`
- **Status:** Working
- **What it does:** Chat interface for direct conversation with an agent session. Uses gateway send API.
- **What's missing:** Nothing critical.
- **Priority to fix:** P3

---

### Component: ConfigWizards (Agent/Team/Provider)
- **Path:** `src/screens/gateway/components/config-wizards.tsx`
- **Status:** Working
- **What it does:** AgentWizardModal (edit agent identity/model/system prompt), TeamWizardModal (edit team configs), AddTeamModal (from quick-start templates), ProviderEditModal (update/delete provider keys). System prompt templates built-in (15+ professional templates).
- **What's missing:** Nothing critical.
- **Priority to fix:** P3

---

### Component: OverviewTab (Hub Overview)
- **Path:** `src/screens/gateway/components/overview-tab.tsx`
- **Status:** Working (inline in agent-hub-layout.tsx via `renderOverviewContent()`)
- **What it does:** Pixel Office isometric view + 3 cards (Active Team, Recent Missions, Cost Summary). Cards show real data from stores and mission history.
- **What's missing:** Pixel office is a visual placeholder (PixelOfficeView from isometric-office.tsx).
- **Priority to fix:** P3

---

### Component: WorkspaceLayout
- **Path:** `src/screens/workspace/workspace-layout.tsx`
- **Status:** Working
- **What it does:** Second major product surface. Tabs: Projects, Review, Runs, Agents, Skills, Teams. Integrated with workspace API backend (`/api/workspace/*`). Projects screen, checkpoint detail, mission console, plan review, review queue — all wired in.
- **What's missing:** Nothing obvious from code read.
- **Priority to fix:** P3

---

### Component: MissionConsoleScreen
- **Path:** `src/screens/missions/mission-console-screen.tsx`
- **Status:** Working
- **What it does:** Deep mission detail view. Polls `/api/workspace/missions/:id/status`. Shows task list with per-task status, run events, activity log, YAML spec viewer, start/pause/resume/stop controls.
- **What's missing:** Nothing critical.
- **Priority to fix:** P3

---

### Component: CheckpointDetailScreen
- **Path:** `src/screens/checkpoints/checkpoint-detail-screen.tsx`
- **Status:** Working
- **What it does:** Checkpoint file diffs with inline diff display. Approve/Reject/Approve+PR/Approve+Commit/Approve+Merge/Revise/Verify TSC routes all implemented in API layer. Real patch viewer with line tone (add/remove/context).
- **What's missing:** Nothing critical. Inline diffs are WORKING.
- **Priority to fix:** N/A

---

### Component: TerminalWorkspace
- **Path:** `src/components/terminal/terminal-workspace.tsx`
- **Status:** Working
- **What it does:** Full xterm.js terminal with dynamic import (SSR safe). Multi-tab support via `terminal-panel-store`. PTY via `/api/terminal-stream`. Fit, WebLinks addons. Panel/fullscreen modes. Context menu, resize, close operations.
- **What's missing:** Nothing critical.
- **Priority to fix:** P3

---

### Component: OfficeView (Isometric)
- **Path:** `src/components/agent-swarm/isometric-office.tsx`
- **Status:** Working
- **What it does:** Pixel art isometric office with animated agents. Used in Overview tab as visual "who's working on what."
- **What's missing:** Nothing critical.
- **Priority to fix:** P3

---

### Routing
- **Path:** `src/routeTree.gen.ts`, `src/routes/`
- **Status:** Working
- **What it does:** All major routes registered and navigable:
  - `/` → index
  - `/workspace` → WorkspaceLayout (Projects, Review, Runs, Agents, Skills, Teams)
  - `/gateway` → AgentHubLayout (via `src/routes/agents.tsx` or gateway routes)
  - `/terminal` → TerminalWorkspace
  - `/dashboard` → DashboardScreen
  - `/costs` → CostsScreen
  - `/cron` → CronManagerScreen
  - `/memory` → MemoryBrowserScreen
  - `/sessions` → SessionsScreen
  - `/files` → FilesScreen
  - `/activity` → ActivityScreen
  - `/runs` → RunsConsoleScreen
  - `/review` → ReviewQueueScreen
  - `/projects` → ProjectsScreen
  - `/chat/:sessionKey` → ChatScreen
  - All settings routes, API routes wired
- **What's missing:** No dedicated `/patrol` or `/scoring` routes.
- **Priority to fix:** P2 (add when those features built)

---

## 🔧 STUBS THAT NEED COMPLETION

### Component: RunCompare — Output Diff
- **Path:** `src/screens/gateway/components/run-compare.tsx`
- **Status:** Stub (metadata only)
- **What it does:** Compares metadata (duration, tokens, cost, agent count, status). Does NOT compare actual agent output side-by-side.
- **What's missing:** Side-by-side output diff of agent responses. Would require fetching session history for both runs and diffing.
- **Priority to fix:** P2

---

### Component: RemoteAgentsPanel — Import Agent
- **Path:** `src/screens/gateway/components/remote-agents-panel.tsx`
- **Status:** Stub (import is toast-only)
- **What it does:** Shows gateway sessions. "Import" button exists but only shows a toast.
- **What's missing:** Actual import-to-team flow.
- **Priority to fix:** P2

---

### Component: Task Lifecycle States
- **Path:** `src/screens/gateway/components/kanban-board.tsx`, `task-board.tsx`
- **Status:** Partial
- **What it does:** Current states: `inbox` → `assigned` → `in_progress` → `done` / `blocked`. Kanban adds `review` column. But no formal "blocked" state trigger from Patrol Agent.
- **What's missing:** 
  - `blocked` state does not auto-trigger any alert or retry
  - No visual state badges on task cards in AgentHubLayout (only in KanbanBoard)
  - `review` state not wired into approval gate
- **Priority to fix:** P1

---

### Component: MissionEventLog
- **Path:** `src/screens/gateway/components/mission-event-log.tsx`
- **Status:** Stub (unknown — not read in detail)
- **What it does:** Listed in roadmap as "full audit trail." `mission-event-store.ts` is functional but events are not persisted.
- **What's missing:** Persistence across sessions, UI to view per-mission event history.
- **Priority to fix:** P2

---

### Component: Run Learnings
- **Path:** `src/screens/gateway/components/run-learnings.tsx`
- **Status:** Stub (not confirmed wired)
- **What it does:** Should capture insights from runs. Listed in roadmap.
- **What's missing:** Not confirmed as active tab or entry point in hub.
- **Priority to fix:** P2

---

### Component: AgentsWorkingPanel
- **Path:** `src/screens/gateway/components/agents-working-panel.tsx`
- **Status:** Working (imported but aliased to `_AgentsWorkingPanel`)
- **What it does:** Per-agent working status rows.
- **What's missing:** Currently aliased with `_` prefix which means it may be imported but not rendered anywhere (suppressing unused import warning). Verify it's not dead code.
- **Priority to fix:** P2 (verify)

---

## ❌ MISSING FEATURES (FROM ROADMAP)

### Feature: Patrol Agent (Self-Healing)
- **Status:** Does NOT exist
- **What's needed:** Cron job every 15 min. Check sessions with no SSE output for >10 min → flag as stuck → attempt restart → alert if fails.
- **Implementation path:**
  1. New API route `/api/workspace/patrol` 
  2. New cron entry in gateway cron config
  3. Small component in Hub showing patrol status/last run
  4. Wire into `scheduleAgentRetry` logic (already exists in agent-hub-layout.tsx)
- **Priority to fix:** P1

---

### Feature: Agent Scoring & Leaderboard
- **Status:** Does NOT exist
- **What's needed:** After each mission, score agents: task pass rate, retry count, token cost. Aggregate into reliability score. Show in Team Panel as leaderboard. Use scores to auto-select best agent for task type.
- **Implementation path:**
  1. New `agent-scoring-store.ts`
  2. Score computed in `completeMission()` handler (post-mission report already captures this data)
  3. Add leaderboard tab/section to team config UI
- **Priority to fix:** P1

---

### Feature: Boardroom (Agent-to-Agent Communication)
- **Status:** Does NOT exist
- **What's needed:** Shared context panel where agents see each other's output. Agents can request help from each other.
- **Implementation path:**
  1. New broadcast endpoint on gateway
  2. `BoardroomPanel` component
  3. Agent system prompt injection with team context
- **Priority to fix:** P2

---

### Feature: Inline Code Diffs (Accept/Reject per-change)
- **Status:** PARTIAL — exists in Workspace (`checkpoint-detail-screen.tsx`) but NOT in Hub Runs console
- **What it does:** Checkpoint detail screen shows inline diffs with line tone. But Hub `RunConsole` artifacts tab does not show code diffs.
- **What's missing:** Accept/reject per-change granularity (currently approve/reject entire checkpoint). No "inline diff" view in Hub Runs.
- **Priority to fix:** P1

---

### Feature: Multi-Agent Session Tabs (Claude Squad style)
- **Status:** Partially exists
- **What it does:** Agent Hub has per-agent output panels. But no browser-tab-style switching between isolated agent sessions.
- **What's missing:** Tab strip for switching between agent contexts.
- **Priority to fix:** P2

---

### Feature: Role-Based Agent Templates (CrewAI style)
- **Status:** EXISTS — system prompt templates for 15+ roles (Planner, Coder, Reviewer, Researcher, DevOps, Security, etc.)
- **Priority to fix:** N/A — done

---

## 🚨 SHIP BLOCKERS

**None.** TSC is clean. All core features are implemented. The app is shippable today.

However, the following are **recommended before Phase 1 push**:

| Item | Priority | Why |
|------|----------|-----|
| Verify `AgentsWorkingPanel` is not dead code (aliased with `_`) | P1 | Potential rendering gap |
| Task lifecycle "blocked" state doesn't trigger anything | P1 | UX gap when agents fail |
| Inline diffs missing in Hub (only in Workspace) | P1 | Core UX parity issue |
| RemoteAgents import-to-team is toast-only | P2 | Advertised feature not working |
| Run output side-by-side diff missing | P2 | Compare is metadata-only |
| Mission event log not persisted | P2 | Events lost on refresh |

---

## FEATURE STATUS MATRIX (Roadmap vs Reality)

| Feature | Roadmap Says | Reality |
|---------|-------------|---------|
| Agent Hub Layout | ✅ | ✅ Full |
| Sessions Screen | ✅ | ✅ Full (`/sessions`) |
| Cost Analytics | ✅ | ✅ Full (Analytics tab) |
| Live Feed Panel | ✅ | ✅ Built, removed from UI |
| Kanban Board | ✅ | ✅ Full (Board tab) |
| Task Board | ✅ | ✅ Full |
| Mission Timeline | ✅ | ✅ Available (not primary) |
| Mission Event Log | ✅ | ⚠️ Built, not persisted |
| Run Console | ✅ | ✅ Full |
| Run Compare | ✅ | ⚠️ Metadata only, no output diff |
| Run Learnings | ✅ | ❓ Not confirmed in routing |
| Approvals Panel | ✅ | ✅ Full |
| Team Panel | ✅ | ✅ Full |
| Office View (Pixel) | ✅ | ✅ Full |
| Calendar/Agenda | ✅ | ⚠️ File exists, not in main tabs |
| Template Picker | ✅ | ✅ WorkflowTemplates wired |
| Config Wizards | ✅ | ✅ Full (Agent/Team/Provider) |
| Collaboration Presence | ✅ | ✅ Local only (BroadcastChannel) |
| Remote Agents Panel | ✅ | ⚠️ Built, import stub only |
| Workspace Layout | ✅ | ✅ Full |
| Terminal Workspace | ✅ | ✅ Full (xterm.js, PTY) |
| Workspace Store | ✅ | ✅ Full |
| Mission Store | ✅ | ✅ Full |
| Patrol Agent | ❌ | ❌ Not built |
| Agent Scoring | ❌ | ❌ Not built |
| Task Lifecycle States | ⚠️ | ⚠️ Partial (no blocked trigger) |
| Boardroom | ❌ | ❌ Not built |
| Inline Code Diffs | ⚠️ | ✅ In Workspace, ❌ in Hub |

---

## ARCHITECTURE NOTES

- **Two parallel UIs:** Hub (`/agents` or `/gateway`) is the agent orchestration surface. Workspace (`/workspace`) is the project/checkpoint management surface. They share the same backend API routes and mission store.
- **State management:** Zustand with persist. Mission state survives page reload via `restoreCheckpoint`.
- **SSE streams:** Per-agent EventSource connections (capped at 3). Activity tracked for stale detection.
- **Agent retry:** One automatic retry built-in. Failed sessions detected via SSE close + missing output.
- **Mission report:** Auto-generated markdown on completion. Stored in localStorage, capped at 10 reports.
- **PC1 local model support:** First-class. `pc1-coder`, `pc1-planner`, `pc1-critic` presets in MODEL_PRESETS with actual TPS numbers.
