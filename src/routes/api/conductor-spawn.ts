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

let cachedSkill: string | null = null

function loadDispatchSkill(): string {
  if (cachedSkill) return cachedSkill
  try {
    const candidates = [
      resolve(process.cwd(), 'skills/workspace-dispatch/SKILL.md'),
      resolve(process.env.HOME ?? '~', '.openclaw/workspace/skills/workspace-dispatch/SKILL.md'),
    ]
    for (const p of candidates) {
      try {
        cachedSkill = readFileSync(p, 'utf-8')
        return cachedSkill
      } catch {
        continue
      }
    }
  } catch {
    // ignore
  }
  return ''
}

function buildOrchestratorPrompt(goal: string, skill: string): string {
  return [
    'You are a mission orchestrator. Execute this mission autonomously.',
    '',
    '## Dispatch Skill Instructions',
    '',
    skill,
    '',
    '## Mission',
    '',
    `Goal: ${goal}`,
    '',
    '## Critical Rules',
    '- Use sessions_spawn to create worker agents for each task',
    '- Do NOT do the work yourself — spawn workers',
    '- Do NOT ask for confirmation — start immediately',
    '- Label workers as "worker-<task-slug>" so the UI can track them',
    '- Each worker gets a self-contained prompt with the task + exit criteria',
    '- Workers should write output to /tmp/dispatch-<slug>/ directories',
    '- Verify exit criteria after each worker completes',
    '- Report a summary when all tasks are done',
  ].join('\n')
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

          if (!goal) {
            return json({ ok: false, error: 'goal required' }, { status: 400 })
          }

          const skill = loadDispatchSkill()
          const prompt = buildOrchestratorPrompt(goal, skill)

          const sessionKey = `agent:main:conductor-${Date.now()}`
          const result = await spawnViaHooks(sessionKey, prompt)

          if (!result.ok) {
            return json({ ok: false, error: result.error ?? 'Failed to spawn orchestrator' }, { status: 500 })
          }

          return json({
            ok: true,
            sessionKey,
            runId: result.runId ?? null,
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
