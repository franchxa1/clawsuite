# Final Ship Audit

Date: 2026-03-25
Scope: User-visible flows only
Checks run:
- `npx tsc --noEmit` -> 0 errors
- Deleted-route grep across `src`/`electron`
- Targeted review of Conductor, Chat/sidebar, Cron, Dashboard, Settings, mobile tab bar/sidebar nav, Agent View panel

## SHIP BLOCKER

### 1. Legacy `Agent Hub` flow is still live in shipped navigation and route aliases
- Impact: users can still enter the old `Agent Hub` path/name instead of `Conductor`, and the app then shows inconsistent labeling and nav state.
- Evidence:
  - Electron tray still exposes `🤖 Agent Hub` and routes to `/agent-swarm`: [electron/main.cjs](/Users/aurora/.openclaw/workspace/clawsuite/electron/main.cjs#L346)
  - The `/agent-swarm` route still sets the page title and loading/error copy to `Agent Hub`: [src/routes/agent-swarm.tsx](/Users/aurora/.openclaw/workspace/clawsuite/src/routes/agent-swarm.tsx#L5)
  - Sidebar only marks Conductor active for `/conductor`, not `/agent-swarm`, so the user can land in the same screen with the wrong nav highlight: [src/screens/chat/components/chat-sidebar.tsx](/Users/aurora/.openclaw/workspace/clawsuite/src/screens/chat/components/chat-sidebar.tsx#L536)
  - Mobile tab bar already treats `/agent-swarm` and `/agents` as Conductor, which proves nav behavior is now split across surfaces: [src/components/mobile-tab-bar.tsx](/Users/aurora/.openclaw/workspace/clawsuite/src/components/mobile-tab-bar.tsx#L44)
- Why this is a blocker: this is not just stale internal naming. It is a user-visible entry path, title, and active-nav mismatch on a core flow.

## POLISH

### 1. Conductor home has no true empty state for recent missions
- Impact: on a fresh install or clean state, the `Recent Missions` area disappears entirely instead of showing a clear empty state.
- Evidence:
  - The whole section is gated behind `hasMissionHistory || conductor.recentSessions.length > 0`: [src/screens/gateway/conductor.tsx](/Users/aurora/.openclaw/workspace/clawsuite/src/screens/gateway/conductor.tsx#L1410)
  - The fallback text only runs after the section has already rendered, so zero-history users never see it: [src/screens/gateway/conductor.tsx](/Users/aurora/.openclaw/workspace/clawsuite/src/screens/gateway/conductor.tsx#L1532)
- Ship impact: not broken, but it reads unfinished in a core first-run flow.

### 2. Cron empty-state copy is wrong when there are no jobs at all
- Impact: empty cron state says `No cron jobs matched your filters.` even when there are simply no jobs yet.
- Evidence:
  - [src/components/cron-manager/CronJobList.tsx](/Users/aurora/.openclaw/workspace/clawsuite/src/components/cron-manager/CronJobList.tsx#L153)
- Ship impact: low, but it is the first thing users see in a clean Cron setup and feels like a bug.

## ACCEPTED

### 1. No user-visible references to the deleted screen routes were found in the audited core flows
- Searched for: `/browser`, `/workspace`, `/instances`, `/projects`, `/mission-console`, `/plan-review`, `/review`, `/runs`, `/new-project`, `/workspace-agents`, `/workspace-skills`, `/workspace-teams`
- Result: no live user-facing hits in the audited Conductor, Chat, Cron, Dashboard, Settings, mobile nav, or Agent View surfaces.
- Note: grep still finds generated/internal references such as API/browser/workspace entries in `routeTree.gen.ts`, but those are not the deleted UI flows asked for in this pass.

### 2. No compile-time breakage found from deleted-module cleanup
- `npx tsc --noEmit` passed cleanly.
- I did not find a user-facing broken import in the audited flows.

### 3. Dashboard overflow panel links are live
- Checked links surfaced there: Memory, Tasks, Terminal, Cron, Logs, Debug, Chat, Conductor, Channels, Costs.
- Result: all resolve to existing routes, with `/logs` intentionally redirecting to `/activity`.
