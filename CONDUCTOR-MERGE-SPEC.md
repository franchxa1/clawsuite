# Conductor ↔ Workspace Merge Spec

## Goal
Rewire Conductor to use the Workspace daemon as its backend instead of the client-side orchestrator. Conductor becomes the enterprise UI for the Workspace system.

## API Contracts (from existing workspace screens)

### Phase 1: Home → Decompose + Create Mission

**Decompose Goal → Tasks:**
```
POST /api/workspace/decompose
Body: { goal: string, project_id?: string }
Response: { tasks: Array<{ title, description, agent? }> }
```

**Create Project (if needed):**
```
POST /api/workspace/projects
Body: { name: string, path?: string }
Response: { id, name, ... }
```

**Create Mission:**
```
POST /api/workspace/missions
Body: { name: string, project_id: string, phase_id?: string, tasks?: Array<{ name, description }> }
Response: { id, name, status, ... }
```

**Start Mission:**
```
POST /api/workspace/missions/$id/start
Body: {}
Response: { ok: true }
```

### Phase 2: Active → Live Streaming

**Mission Status (poll every 3s):**
```
GET /api/workspace/missions/$id/status
Response: {
  mission: { id, name, status, progress },
  task_breakdown: Array<{ id, name, status, agent_id, started_at, completed_at }>,
  running_agents: string[],
  completed_count: number,
  total_count: number,
  estimated_completion: string | null
}
```

**Task Runs (poll every 3-5s):**
```
GET /api/workspace/task-runs?project_id=$id
Response: Array<{ id, task_id, mission_id, status, started_at, completed_at, session_id, session_label }>
```

**SSE Events (real-time):**
```
GET /api/workspace/events (EventSource)
Events: task_run.started, task_run.updated, task_run.output, task_run.completed,
        checkpoint.created, checkpoint.updated, mission.updated, mission.progress
```

**Run Events (per task run):**
```
GET /api/workspace/task-runs/$id/events (SSE)
Events: output, tool_use, status, checkpoint, error
```

**Mission Control:**
```
POST /api/workspace/missions/$id/pause   → { ok: true }
POST /api/workspace/missions/$id/resume  → { ok: true }
POST /api/workspace/missions/$id/stop    → { ok: true }
POST /api/workspace/task-runs/$id/stop   → { ok: true }
POST /api/workspace/task-runs/$id/pause  → { ok: true }
POST /api/workspace/task-runs/$id/retry  → { ok: true }
```

### Phase 3: Checkpoints Inline

**List Checkpoints:**
```
GET /api/workspace/checkpoints?mission_id=$id
Response: Array<{ id, task_run_id, status, diff_summary, created_at }>
```

**Checkpoint Detail + Diff:**
```
GET /api/workspace/checkpoints/$id
GET /api/workspace/checkpoints/$id/diff
```

**Checkpoint Actions:**
```
POST /api/workspace/checkpoints/$id/approve
POST /api/workspace/checkpoints/$id/approve-and-commit
POST /api/workspace/checkpoints/$id/approve-and-merge
POST /api/workspace/checkpoints/$id/approve-and-pr
POST /api/workspace/checkpoints/$id/reject
POST /api/workspace/checkpoints/$id/revise
```

### Phase 4: Complete

**Stats:**
```
GET /api/workspace/stats
Response: { running, checkpointsPending, ... }
```

## Implementation Plan

### What Changes in conductor.tsx

1. **Remove** all imports from `use-mission-orchestrator.ts` — daemon handles orchestration
2. **Remove** `useMissionOrchestrator()` hook call
3. **Remove** client-side `useMissionStore` for session management (keep for local UI state only)
4. **Add** `useWorkspaceSse()` for real-time daemon events
5. **Add** `useQuery` hooks for mission status, task runs, checkpoints
6. **Add** `useMutation` hooks for decompose, create mission, start, pause, stop

### Home Phase Changes
- On "Launch Mission": 
  1. Call `/api/workspace/decompose` with goal text
  2. Show task preview (new intermediate step)
  3. User confirms → create project + mission + start

### Active Phase Changes
- Mission status from `GET /api/workspace/missions/$id/status` (poll 3s)
- Task list from mission status `task_breakdown` (not client-side tasks)
- Agent status from `running_agents` + task run status
- Live output from SSE `task_run.output` events via `use-workspace-sse`
- Pause/resume/stop via workspace API mutations
- Checkpoints appear inline when `checkpoint.created` SSE fires

### Complete Phase Changes  
- Mission complete when status poll returns `completed`
- Summary from daemon (tasks completed, agents used, time)
- Checkpoints review available inline

### New Hook: use-conductor-workspace.ts
Encapsulates all workspace API calls for Conductor:
- decomposeMission(goal) → tasks
- createAndStartMission(name, tasks, projectId?) → missionId
- getMissionStatus(missionId) → useQuery
- getTaskRuns(missionId) → useQuery  
- pauseMission / resumeMission / stopMission → useMutation
- approveCheckpoint / rejectCheckpoint → useMutation

### Files to Create
- `src/screens/gateway/hooks/use-conductor-workspace.ts` — workspace API hook

### Files to Modify
- `src/screens/gateway/conductor.tsx` — rewire to workspace backend

### Files NOT to Modify
- Everything in `src/screens/workspace/` — untouched
- Everything in `src/screens/missions/` — untouched  
- Everything in `src/screens/projects/` — untouched
- `agent-hub-layout.tsx` — untouched
- `use-mission-orchestrator.ts` — keep for Agent Hub, Conductor stops using it
