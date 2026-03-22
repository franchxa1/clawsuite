import { AGENT_EXECUTION_DISABLED_MESSAGE } from "./agent-execution-disabled";
import { Tracker } from "./tracker";
import type { TaskRunOutcome } from "./types";

export class AgentRunner {
  constructor(_tracker: Tracker) {}

  async runTask(input: {
    project: unknown;
    task: unknown;
    taskRun: unknown;
    agent: unknown;
    attempt: number;
    config?: {
      autoApprove?: boolean;
    };
    signal?: AbortSignal;
  }): Promise<TaskRunOutcome> {
    void input;
    throw new Error(AGENT_EXECUTION_DISABLED_MESSAGE);
  }
}
