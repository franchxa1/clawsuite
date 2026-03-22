const DEFAULT_GATEWAY_URL = "http://127.0.0.1:18789";

export interface SpawnSessionParams {
  task: string
  agentId?: string
  model?: string
  label?: string
  cwd?: string
  runTimeoutSeconds?: number
  mode?: "run" | "session"
}

export interface SpawnSessionResult {
  sessionKey: string
  sessionId?: string
}

export interface SessionStatus {
  status: "running" | "completed" | "failed" | "timeout" | "unknown"
  lastMessage?: string
  totalTokens?: number
  model?: string
}

export interface SessionMessage {
  role: string
  content: string
  timestamp?: string
}

type RequestOptions = {
  baseUrl?: string
  token?: string
}

type GatewaySpawnResult = {
  sessionKey?: string
  sessionId?: string
}

type GatewayStatusResult = {
  status?: string
  lastMessage?: string
  totalTokens?: number
  model?: string
}

type GatewayHistoryResult = {
  messages?: SessionMessage[]
}

function mapStatus(status: string | undefined): SessionStatus["status"] {
  switch (status) {
    case "active":
    case "running":
      return "running"
    case "completed":
    case "done":
      return "completed"
    case "failed":
    case "error":
      return "failed"
    case "timeout":
      return "timeout"
    default:
      return "unknown"
  }
}

export class OpenClawClient {
  private readonly baseUrl: string
  private readonly token?: string

  constructor(options?: RequestOptions) {
    this.baseUrl =
      options?.baseUrl ??
      process.env.OPENCLAW_GATEWAY_URL ??
      DEFAULT_GATEWAY_URL
    this.token = options?.token ?? process.env.OPENCLAW_GATEWAY_TOKEN
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(
        `OpenClaw API ${method} ${path} failed: ${response.status} ${text}`,
      )
    }

    if (response.status === 204) {
      return undefined as T
    }

    const text = await response.text()
    if (!text.trim()) {
      return undefined as T
    }

    return JSON.parse(text) as T
  }

  async spawnSession(
    params: SpawnSessionParams,
  ): Promise<SpawnSessionResult> {
    const result = await this.request<GatewaySpawnResult>(
      "POST",
      "/api/sessions/spawn",
      {
        task: params.task,
        agentId: params.agentId,
        model: params.model,
        label: params.label,
        cwd: params.cwd,
        runTimeoutSeconds: params.runTimeoutSeconds ?? 600,
        mode: params.mode ?? "run",
        runtime: "subagent",
      },
    )

    return {
      sessionKey: result.sessionKey ?? "",
      sessionId: result.sessionId,
    }
  }

  async getSessionStatus(sessionKey: string): Promise<SessionStatus> {
    try {
      const result = await this.request<GatewayStatusResult>(
        "GET",
        `/api/sessions/${encodeURIComponent(sessionKey)}/status`,
      )

      return {
        status: mapStatus(result.status),
        lastMessage: result.lastMessage,
        totalTokens: result.totalTokens,
        model: result.model,
      }
    } catch {
      return { status: "unknown" }
    }
  }

  async sendMessage(sessionKey: string, message: string): Promise<void> {
    await this.request<void>(
      "POST",
      `/api/sessions/${encodeURIComponent(sessionKey)}/messages`,
      { message },
    )
  }

  async getSessionHistory(
    sessionKey: string,
    limit?: number,
  ): Promise<SessionMessage[]> {
    const query = limit ? `?limit=${limit}` : ""
    const result = await this.request<GatewayHistoryResult>(
      "GET",
      `/api/sessions/${encodeURIComponent(sessionKey)}/history${query}`,
    )
    return result.messages ?? []
  }

  async systemEvent(
    text: string,
    mode: "now" | "next-heartbeat" = "now",
  ): Promise<void> {
    await this.request<void>("POST", "/api/system/event", { text, mode })
  }
}
