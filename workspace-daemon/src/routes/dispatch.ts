import { Router } from "express";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { Tracker } from "../tracker";

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "mission";
}

const STATE_PATH = join(
  process.env.HOME || "/Users/aurora",
  ".openclaw/workspace/data/dispatch-state.json"
);

function fireDispatchTrigger(missionId: string, mission: string, tasks: any[] = [], projectPath: string = "", daemonMissionId: string | null = null): void {
  // Build task ID map so the agent knows which daemon IDs to PATCH
  const taskIdList = tasks.map((t: any) => {
    const dbId = t.dbId || t.id || "unknown";
    const title = t.title || t.name || "Task";
    return `${dbId}: ${title}`;
  }).join(", ");

  const missionPatchId = daemonMissionId || missionId;
  const text = [
    `[dispatch] Mission started.`,
    `Goal: "${mission.slice(0, 120)}"`,
    `Daemon mission ID: ${missionPatchId}`,
    `Project path: ${projectPath}`,
    `Tasks (daemon DB IDs): ${taskIdList}`,
    `Read the workspace-dispatch skill and execute the mission. PATCH task status to http://localhost:3099/api/workspace/tasks/<DB_ID> as you go.`,
  ].join("\n");

  // Simple wake event — reaches the main agent session, zero config needed
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? "http://127.0.0.1:18789";
  fetch(`${gatewayUrl}/api/cron/wake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mode: "now" }),
  })
    .then((res) => {
      if (res.ok) {
        console.log("[dispatch] Wake sent for", missionId);
      } else {
        console.error("[dispatch] Wake returned", res.status);
      }
    })
    .catch((err: Error) => {
      console.error("[dispatch] Wake failed:", err.message);
    });
}

export function createDispatchRouter(tracker?: Tracker): Router {
  const router = Router();

  router.get("/state", (_req, res) => {
    if (!existsSync(STATE_PATH)) {
      return res.json({ status: "idle", tasks: [] });
    }
    try {
      const raw = readFileSync(STATE_PATH, "utf-8");
      res.json(JSON.parse(raw));
    } catch {
      res.status(500).json({ error: "Failed to read dispatch state" });
    }
  });

  router.post("/start", (req, res) => {
    const { mission, mode, tasks, projectPath } = req.body;
    if (!mission) return res.status(400).json({ error: "mission is required" });

    const missionId = "mission-" + Date.now();
    const now = new Date().toISOString();
    const resolvedProjectPath =
      typeof projectPath === "string" && projectPath.trim().length > 0
        ? projectPath.trim()
        : `/tmp/dispatch-${slugify(mission)}-${Date.now()}`;

    const state = {
      mission_id: missionId,
      mission,
      status: "pending_dispatch",
      created_at: now,
      updated_at: now,
      current_task_id: null,
      tasks: tasks || [],
      options: { mode: mode || "autonomous", max_parallel: 1, project_path: resolvedProjectPath },
    };

    // Write dispatch state file
    mkdirSync(dirname(STATE_PATH), { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

    // Sync to daemon SQLite so Recent Missions shows it
    // Capture the real DB task IDs so the orchestrator can PATCH them
    let projectId: string | null = null;
    let dbMissionId: string | null = null;
    const dbTaskMap: Array<{ dispatchId: string; dbId: string; title: string; description: string; type: string }> = [];
    if (tracker) {
      try {
        const project = tracker.createProject({
          name: mission.slice(0, 80),
          path: resolvedProjectPath,
          spec: mission,
        });
        projectId = project.id;
        const phase = tracker.createPhase({ project_id: project.id, name: "Phase 1" });
        const dbMission = tracker.createMission({ phase_id: phase.id, name: mission.slice(0, 100) });
        if (dbMission) {
          dbMissionId = dbMission.id;
          for (let i = 0; i < (tasks || []).length; i++) {
            const task = tasks[i];
            const dbTask = tracker.createTask({
              mission_id: dbMission.id,
              name: task.title || task.name || "Task",
              description: task.description || "",
              agent_type: task.type || null,
            });
            if (dbTask) {
              dbTaskMap.push({
                dispatchId: task.id || `task-${String(i + 1).padStart(3, "0")}`,
                dbId: dbTask.id,
                title: task.title || task.name || "Task",
                description: task.description || "",
                type: task.type || "coding",
              });
            }
          }
          // Start the mission so status shows as running
          tracker.startMission(dbMission.id);
        }
      } catch {
        // SQLite sync is best-effort
      }
    }

    // Spawn orchestrator agent — pass the DB task IDs so it can update the daemon
    const tasksWithDbIds = dbTaskMap.length > 0 ? dbTaskMap : (tasks || []);
    fireDispatchTrigger(missionId, mission, tasksWithDbIds, resolvedProjectPath, dbMissionId);

    res.json({ ok: true, mission_id: missionId, project_id: projectId });
  });

  return router;
}
