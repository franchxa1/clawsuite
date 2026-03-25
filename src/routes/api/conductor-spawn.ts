import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { requireJsonContentType } from '../../server/rate-limit'

type HooksResponse = {
  ok: boolean
  runId?: string
  error?: string
}

function getGatewayUrl(): string {
  return process.env.OPENCLAW_GATEWAY_URL ?? `http://127.0.0.1:${process.env.OPENCLAW_GATEWAY_PORT ?? '18789'}`
}

function getHooksToken(): string {
  try {
    const configPath = resolve(process.env.OPENCLAW_CONFIG_PATH ?? resolve(homedir(), '.openclaw/openclaw.json'))
    const raw = readFileSync(configPath, 'utf-8')
    const match = raw.match(/["']?token["']?\s*[:=]\s*["']([^"']+)["']/)
    return match?.[1] ?? ''
  } catch {
    return process.env.OPENCLAW_HOOKS_TOKEN ?? ''
  }
}

async function spawnViaHooks(sessionKey: string, message: string): Promise<HooksResponse> {
  const url = `${getGatewayUrl()}/hooks/agent`
  const token = getHooksToken()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ sessionKey, message }),
  })
  return (await response.json()) as HooksResponse
}

type ConductorSpawnOptions = {
  orchestratorModel?: string | null
  workerModel?: string | null
  projectsDir?: string | null
  multiAgent?: boolean
  maxParallel?: number | null
}

type OrchestratorPromptResult = {
  prompt: string
  projectPath: string | null
}

let cachedDispatchSkill: string | null = null
let cachedMultiDispatchSkill: string | null = null

function loadDispatchSkill(): string {
  if (cachedDispatchSkill) return cachedDispatchSkill
  try {
    const candidates = [
      resolve(process.cwd(), 'skills/workspace-dispatch/SKILL.md'),
      resolve(process.env.HOME ?? '~', '.openclaw/workspace/skills/workspace-dispatch/SKILL.md'),
    ]
    for (const p of candidates) {
      try {
        cachedDispatchSkill = readFileSync(p, 'utf-8')
        return cachedDispatchSkill
      } catch {
        continue
      }
    }
  } catch {
    // ignore
  }
  return ''
}

function loadMultiDispatchSkill(): string {
  if (cachedMultiDispatchSkill) return cachedMultiDispatchSkill
  try {
    const candidates = [
      resolve(process.cwd(), 'skills/workspace-dispatch-multi/SKILL.md'),
      resolve(process.env.HOME ?? '~', '.openclaw/workspace/skills/workspace-dispatch-multi/SKILL.md'),
    ]
    for (const p of candidates) {
      try {
        cachedMultiDispatchSkill = readFileSync(p, 'utf-8')
        return cachedMultiDispatchSkill
      } catch {
        continue
      }
    }
  } catch {
    // ignore
  }
  return ''
}

function expandUserPath(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (trimmed === '~') return homedir()
  if (trimmed.startsWith('~/')) return resolve(homedir(), trimmed.slice(2))
  return resolve(trimmed)
}

function normalizeProjectsDir(input: string | null | undefined): string {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/\/+$/, '')
}

function formatTimestampSuffix(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function slugifyGoal(goal: string): string {
  const normalized = goal
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return (normalized || 'project').slice(0, 40).replace(/-+$/g, '') || 'project'
}

function createPersistentProjectPath(goal: string, projectsDir: string): string | null {
  const normalizedDir = normalizeProjectsDir(projectsDir)
  if (!normalizedDir || normalizedDir === '/tmp') return null
  const absoluteDir = expandUserPath(normalizedDir)
  if (!absoluteDir || absoluteDir === '/tmp') return null
  return `${absoluteDir}/${slugifyGoal(goal)}-${formatTimestampSuffix()}`
}

function buildOrchestratorPrompt(
  goal: string,
  skill: string,
  options: ConductorSpawnOptions = {},
): OrchestratorPromptResult {
  const orchestratorModel = typeof options.orchestratorModel === 'string' ? options.orchestratorModel.trim() : ''
  const workerModel = typeof options.workerModel === 'string' ? options.workerModel.trim() : ''
  const projectPath = createPersistentProjectPath(goal, options.projectsDir ?? '')
  const maxParallel =
    typeof options.maxParallel === 'number' && Number.isFinite(options.maxParallel)
      ? Math.min(5, Math.max(1, Math.floor(options.maxParallel)))
      : 1

  return {
    prompt: [
      'You are a mission orchestrator. Execute this mission autonomously.',
      '',
      ...(orchestratorModel ? [`Use model: ${orchestratorModel} for the orchestrator session.`, ''] : []),
      ...(workerModel ? [`Use model: ${workerModel} for workers whenever you spawn them.`, ''] : []),
      ...(
        projectPath
          ? [
              `Project directory: ${projectPath}. Create this directory. All output files must go here (not /tmp). Initialize a git repo with git init. Make a git commit after completing each task with message: checkpoint: {taskName}`,
              '',
            ]
          : []
      ),
      '## Dispatch Skill Instructions',
      '',
      skill,
      '',
      `Max parallel workers: ${maxParallel}. You may spawn up to ${maxParallel} workers simultaneously for independent tasks. Never run 2 tasks that write to the same directory in parallel.`,
      '',
      '## Mission',
      '',
      `Goal: ${goal}`,
      '',
      '## Rate Limit Handling',
      '- If a worker fails due to rate limits (429 errors), retry the task with a different model',
      '- Fallback order: configured worker model → gpt-5.4 → any available model',
      '- Include [RATE_LIMIT_FALLBACK] in the retry worker label so the UI can track model switches',
      '- Example: worker-build-landing-retry-fallback',
      '',
      '## Critical Rules',
      '- Use sessions_spawn to create worker agents for each task',
      '- Do NOT do the work yourself — spawn workers',
      '- Do NOT ask for confirmation — start immediately',
      '- Label workers as "worker-<task-slug>" so the UI can track them',
      '- Each worker gets a self-contained prompt with the task + exit criteria',
      '- Verify exit criteria after each worker completes',
      '- Report a summary when all tasks are done',
    ].join('\n'),
    projectPath,
  }
}


export const Route = createFileRoute('/api/conductor-spawn')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
          const goal = typeof body.goal === 'string' ? body.goal.trim() : ''
          const orchestratorModel =
            typeof body.orchestratorModel === 'string' ? body.orchestratorModel.trim() : ''
          const workerModel = typeof body.workerModel === 'string' ? body.workerModel.trim() : ''
          const projectsDir = typeof body.projectsDir === 'string' ? body.projectsDir.trim() : ''
          const multiAgent = body.multiAgent === true
          const maxParallel =
            typeof body.maxParallel === 'number' && Number.isFinite(body.maxParallel)
              ? Math.min(5, Math.max(1, Math.floor(body.maxParallel)))
              : 1

          if (!goal) {
            return json({ ok: false, error: 'goal required' }, { status: 400 })
          }

          const skill = multiAgent ? loadMultiDispatchSkill() : loadDispatchSkill()
          const { prompt, projectPath } = buildOrchestratorPrompt(goal, skill, {
            orchestratorModel,
            workerModel,
            projectsDir,
            multiAgent,
            maxParallel,
          })

          // Spawn an isolated orchestrator session via hooks endpoint
          const sessionKey = `agent:main:conductor-${Date.now()}`
          const result = await spawnViaHooks(sessionKey, prompt)

          if (!result.ok) {
            return json({ ok: false, error: result.error ?? 'Failed to spawn orchestrator' }, { status: 500 })
          }

          return json({
            ok: true,
            sessionKey,
            runId: result.runId ?? null,
            projectPath,
          })
        } catch (error) {
          return json(
            {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
