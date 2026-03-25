import { useMemo, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  Clock01Icon,
  Rocket01Icon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  fetchSessions,
  type GatewaySession,
} from '@/lib/gateway-api'
import type { AgentWorkingRow } from './components/agents-working-panel'
import { OfficeView } from './components/office-view'
import type { AgentHubLayoutProps } from './components/hub-constants'

export { AgentAvatar } from './components/agent-avatar'

const THEME_STYLE: CSSProperties = {
  ['--theme-bg' as string]: 'var(--color-surface)',
  ['--theme-card' as string]: 'var(--color-primary-50)',
  ['--theme-card2' as string]: 'var(--color-primary-100)',
  ['--theme-border' as string]: 'var(--color-primary-200)',
  ['--theme-border2' as string]: 'var(--color-primary-400)',
  ['--theme-text' as string]: 'var(--color-ink)',
  ['--theme-muted' as string]: 'var(--color-primary-700)',
  ['--theme-muted-2' as string]: 'var(--color-primary-600)',
  ['--theme-accent' as string]: 'var(--color-accent-500)',
  ['--theme-accent-strong' as string]: 'var(--color-accent-600)',
  ['--theme-accent-soft' as string]: 'color-mix(in srgb, var(--color-accent-500) 12%, transparent)',
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime()
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function getSessionLabel(session: GatewaySession): string {
  return (
    readText(session.label) ||
    readText(session.title) ||
    readText(session.derivedTitle) ||
    readText(session.friendlyId) ||
    readText(session.key) ||
    'Untitled session'
  )
}

function getSessionSnippet(session: GatewaySession): string {
  const lastMessage = session.lastMessage
  if (lastMessage && typeof lastMessage === 'object') {
    if (typeof lastMessage.text === 'string' && lastMessage.text.trim()) {
      return lastMessage.text.trim()
    }
    if (Array.isArray(lastMessage.content)) {
      const text = lastMessage.content
        .map((part) => (typeof part?.text === 'string' ? part.text.trim() : ''))
        .filter(Boolean)
        .join(' ')
      if (text) return text
    }
  }
  return readText(session.task) || 'No recent output yet.'
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Unknown'
  const diffMs = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function deriveAgentRows(
  agents: AgentHubLayoutProps['agents'],
  sessions: GatewaySession[],
): AgentWorkingRow[] {
  return agents.map((agent) => {
    const session = sessions.find((entry) => {
      const label = getSessionLabel(entry).toLowerCase()
      const agentName = agent.name.toLowerCase()
      return label === agentName || label.startsWith(`${agentName} `)
    })
    const updatedAt = readTimestamp(session?.updatedAt)
    const statusText = `${readText(session?.status)} ${readText(session?.kind)}`.toLowerCase()
    const status =
      !session ? 'none'
      : /error|failed/.test(statusText) ? 'error'
      : /pause/.test(statusText) ? 'paused'
      : Date.now() - updatedAt < 120_000 ? 'active'
      : 'idle'

    return {
      id: agent.id,
      name: agent.name,
      modelId: readText(session?.model) || 'auto',
      status,
      lastLine: getSessionSnippet(session ?? {}),
      lastAt: updatedAt || undefined,
      taskCount: 0,
      currentTask: readText(session?.task) || undefined,
      sessionKey: readText(session?.friendlyId) || readText(session?.key) || undefined,
      roleDescription: agent.role,
    }
  })
}

export function AgentHubLayout({ agents }: AgentHubLayoutProps) {
  const navigate = useNavigate()
  const sessionsQuery = useQuery({
    queryKey: ['gateway', 'sessions', 'agent-hub'],
    queryFn: async () => (await fetchSessions()).sessions ?? [],
    refetchInterval: 10_000,
  })

  const sessions = sessionsQuery.data ?? []
  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((left, right) => readTimestamp(right.updatedAt) - readTimestamp(left.updatedAt))
        .slice(0, 5),
    [sessions],
  )
  const agentRows = useMemo(() => deriveAgentRows(agents, sessions), [agents, sessions])

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--theme-bg)] text-[var(--theme-text)]" style={THEME_STYLE}>
      <main className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-6 px-4 pb-24 pt-5 md:px-6 md:pt-8">
        <header className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                Agent Hub
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[var(--theme-text)]">
                Start work from the office floor.
              </h1>
              <p className="mt-3 text-sm text-[var(--theme-muted-2)]">
                Launch a mission in Conductor, then watch the agent roster light up here as
                sessions stream through the gateway.
              </p>
            </div>
            <Button
              className="h-11 rounded-xl bg-[var(--theme-accent)] px-5 text-primary-950 hover:bg-[var(--theme-accent-strong)]"
              onClick={() => void navigate({ to: '/conductor' })}
            >
              <HugeiconsIcon icon={Rocket01Icon} size={18} strokeWidth={1.8} />
              Start Mission
            </Button>
          </div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-white shadow-sm">
          <OfficeView
            agentRows={agentRows}
            missionRunning={agentRows.some((agent) => agent.status === 'active')}
            onViewOutput={() => void navigate({ to: '/conductor' })}
            onNewMission={() => void navigate({ to: '/conductor' })}
            processType="parallel"
            hideHeader
            containerHeight={560}
          />
        </section>

        <section className="rounded-3xl border border-[var(--theme-border)] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--theme-text)]">Recent activity</h2>
              <p className="mt-1 text-sm text-[var(--theme-muted-2)]">
                Latest gateway sessions, refreshed automatically.
              </p>
            </div>
            <Button
              variant="secondary"
              className="border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] hover:bg-[var(--theme-card2)]"
              onClick={() => void navigate({ to: '/sessions' })}
            >
              View Sessions
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {sessionsQuery.isPending ? (
              <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-8 text-sm text-[var(--theme-muted)]">
                Loading recent sessions...
              </div>
            ) : sessionsQuery.isError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-700">
                {sessionsQuery.error instanceof Error
                  ? sessionsQuery.error.message
                  : 'Unable to load gateway sessions.'}
              </div>
            ) : recentSessions.length === 0 ? (
              <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-8 text-sm text-[var(--theme-muted)]">
                No recent sessions yet.
              </div>
            ) : (
              recentSessions.map((session) => {
                const sessionKey = readText(session.friendlyId) || readText(session.key)
                const updatedAt = readTimestamp(session.updatedAt)
                const model = readText(session.model) || 'Unknown model'

                return (
                  <button
                    key={sessionKey || getSessionLabel(session)}
                    type="button"
                    onClick={() =>
                      sessionKey
                        ? void navigate({ to: '/chat/$sessionKey', params: { sessionKey } })
                        : void navigate({ to: '/sessions' })
                    }
                    className="flex w-full items-start justify-between gap-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-4 text-left transition-colors hover:bg-[var(--theme-card2)]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--theme-text)]">
                          {getSessionLabel(session)}
                        </span>
                        <span className="rounded-full bg-[var(--theme-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--theme-accent)]">
                          {readText(session.status) || 'active'}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--theme-muted-2)]">
                        {getSessionSnippet(session)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--theme-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={1.7} />
                          {formatRelativeTime(updatedAt)}
                        </span>
                        <span>{model}</span>
                      </div>
                    </div>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={18}
                      strokeWidth={1.8}
                      className={cn('mt-1 shrink-0 text-[var(--theme-muted)]')}
                    />
                  </button>
                )
              })
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
