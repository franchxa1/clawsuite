import { Router } from "express";
import { Tracker } from "../tracker";

export function createStatsRouter(tracker: Tracker): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const projects = tracker.listProjects();
    const missions = tracker.listMissions();
    const checkpoints = tracker.listCheckpoints("pending");
    const taskRuns = tracker.listTaskRuns();
    const agents = tracker.listAgentDirectory();

    const activeMissionCount = missions.filter((mission) => mission.status === "running").length;
    const totalRunCount = taskRuns.length;
    const completedRunCount = taskRuns.filter((run) => run.status === "completed").length;

    res.json({
      projects: projects.length,
      agentsOnline: agents.filter((agent) => agent.status !== "offline").length,
      agentsTotal: agents.length,
      running: activeMissionCount,
      queued: 0,
      paused: missions.filter((mission) => mission.status === "paused").length,
      checkpointsPending: checkpoints.length,
      policyAlerts: 0,
      costToday: 0,
      projectCount: projects.length,
      activeMissionCount,
      pendingCheckpointCount: checkpoints.length,
      totalRunCount,
      completedRunCount,
    });
  });

  return router;
}
