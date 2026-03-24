import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  Cancel01Icon,
  PlayIcon,
  Rocket01Icon,
  Search01Icon,
  TaskDone01Icon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/prompt-kit/markdown'
import { cn } from '@/lib/utils'
import { useConductorGateway } from './hooks/use-conductor-gateway'

type ConductorPhase = 'home' | 'preview' | 'active' | 'complete'
type QuickActionId = 'research' | 'build' | 'review' | 'deploy'

type HistoryMessage = {
  role?: string
  content?: string | Array<{ type?: string; text?: string }>
}

type HistoryResponse = {
  messages?: HistoryMessage[]
  error?: string
}

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
  ['--theme-accent-soft-strong' as string]: 'color-mix(in srgb, var(--color-accent-500) 18%, transparent)',
  ['--theme-shadow' as string]: 'color-mix(in srgb, var(--color-primary-950) 14%, transparent)',
}

const QUICK_ACTIONS: Array<{
  id: QuickActionId
  label: string
  icon: typeof Search01Icon
  prompt: string
}> = [
  {
    id: 'research',
    label: 'Research',
    icon: Search01Icon,
    prompt: 'Research the problem space, gather constraints, compare approaches, and propose the most viable plan.',
  },
  {
    id: 'build',
    label: 'Build',
    icon: PlayIcon,
    prompt: 'Build the requested feature end-to-end, including implementation, validation, and a concise delivery summary.',
  },
  {
    id: 'review',
    label: 'Review',
    icon: TaskDone01Icon,
    prompt: 'Review the current implementation for correctness, regressions, missing tests, and release risks.',
  },
  {
    id: 'deploy',
    label: 'Deploy',
    icon: Rocket01Icon,
    prompt: 'Prepare the work for deployment, verify readiness, and summarize any operational follow-ups.',
  },
]

function formatElapsedTime(startIso: string | null | undefined, now: number): string {
  if (!startIso) return '0s'
  const startMs = new Date(startIso).getTime()
  if (!Number.isFinite(startMs)) return '0s'
  const totalSeconds = Math.max(0, Math.floor((now - startMs) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function formatRelativeTime(value: string | null | undefined, now: number): string {
  if (!value) return 'just now'
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return 'just now'
  const diffSeconds = Math.max(0, Math.floor((now - ms) / 1000))
  if (diffSeconds < 10) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  return `${diffHours}h ago`
}

function getWorkerDot(status: 'running' | 'complete' | 'stale' | 'idle') {
  if (status === 'complete') return { dotClass: 'bg-emerald-400', label: 'Complete' }
  if (status === 'running') return { dotClass: 'bg-sky-400 animate-pulse', label: 'Running' }
  if (status === 'idle') return { dotClass: 'bg-amber-400', label: 'Idle' }
  return { dotClass: 'bg-red-400', label: 'Stale' }
}

function extractMessageText(message: HistoryMessage | undefined): string {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function getLastAssistantMessage(messages: HistoryMessage[] | undefined): string {
  if (!Array.isArray(messages)) return ''
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'assistant') continue
    const text = extractMessageText(message)
    if (text.trim()) return text.trim()
  }
  return ''
}

function extractProjectPath(text: string): string | null {
  const matches = text.match(/\/tmp\/dispatch-[^\s"')`\]>]+/g) ?? []
  for (const raw of matches) {
    // Strip trailing punctuation and markdown artifacts
    const cleaned = raw.replace(/[.,;:!?\-`]+$/, '')
    const normalized = cleaned.replace(/\/(index\.html|dist|build)\/?$/i, '')
    if (normalized.startsWith('/tmp/dispatch-')) return normalized
  }
  return null
}

export function Conductor() {
  const conductor = useConductorGateway()
  const [goalDraft, setGoalDraft] = useState('')
  const [selectedAction, setSelectedAction] = useState<QuickActionId>('build')
  const [selectedWorkerKey, setSelectedWorkerKey] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (conductor.phase === 'idle') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [conductor.phase])

  useEffect(() => {
    if (!selectedWorkerKey) return
    const workerStillVisible = conductor.workers.some((worker) => worker.key === selectedWorkerKey)
    if (!workerStillVisible) setSelectedWorkerKey(null)
  }, [conductor.workers, selectedWorkerKey])

  useEffect(() => {
    if (conductor.phase === 'idle') {
      setSelectedWorkerKey(null)
    }
  }, [conductor.phase])

  const phase: ConductorPhase = useMemo(() => {
    if (conductor.phase === 'idle') return 'home'
    if (conductor.phase === 'decomposing') return 'preview'
    if (conductor.phase === 'running') return 'active'
    return 'complete'
  }, [conductor.phase])

  const handleSubmit = async () => {
    const trimmed = goalDraft.trim()
    if (!trimmed) return
    setSelectedWorkerKey(null)
    await conductor.sendMission(trimmed)
  }

  const totalWorkers = conductor.workers.length
  const completedWorkers = conductor.workers.filter((worker) => worker.status === 'complete').length
  const missionProgress = totalWorkers > 0 ? Math.round((completedWorkers / totalWorkers) * 100) : 0
  const selectedWorker = conductor.workers.find((worker) => worker.key === selectedWorkerKey) ?? null

  const workerHistoryQuery = useQuery({
    queryKey: ['conductor', 'worker-history', selectedWorkerKey],
    queryFn: async () => {
      const response = await fetch(`/api/history?sessionKey=${encodeURIComponent(selectedWorkerKey ?? '')}&limit=20`)
      const payload = (await response.json().catch(() => ({}))) as HistoryResponse
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load worker output')
      }
      return payload
    },
    enabled: !!selectedWorkerKey,
    refetchInterval: phase === 'active' && selectedWorkerKey ? 5_000 : false,
  })

  const selectedWorkerOutput = getLastAssistantMessage(workerHistoryQuery.data?.messages) || (selectedWorkerKey ? conductor.workerOutputs[selectedWorkerKey] ?? '' : '')
  const completePhaseProjectPath = useMemo(() => {
    const workerOutput = [
      ...Object.values(conductor.workerOutputs),
      ...conductor.workers.map((worker) => getLastAssistantMessage(worker.raw.messages as HistoryMessage[] | undefined)),
      selectedWorkerOutput,
    ]
      .filter(Boolean)
      .join('\n')

    return extractProjectPath(`${conductor.streamText}\n${workerOutput}`)
  }, [conductor.streamText, conductor.workerOutputs, conductor.workers, selectedWorkerOutput])

  if (phase === 'home') {
    return (
      <div className="flex h-full min-h-full flex-col bg-[var(--theme-bg)] text-[var(--theme-text)]" style={THEME_STYLE}>
        <main className="mx-auto flex min-h-0 flex-1 w-full max-w-[720px] flex-col items-stretch justify-center px-6 py-8">
          <div className="w-full space-y-8">
            <div className="space-y-3 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--theme-muted)]">
                Conductor
                <span className="size-2 rounded-full bg-emerald-400" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--theme-text)] md:text-4xl">
                What should the team do next?
              </h1>
              <p className="text-sm text-[var(--theme-muted-2)]">
                Describe the mission. Aurora will decompose it in chat, then the worker sessions will appear here live.
              </p>
            </div>

            <section className="w-full overflow-hidden rounded-3xl border border-[var(--theme-border2)] bg-[var(--theme-card)] shadow-[0_24px_80px_var(--theme-shadow)]">
              <textarea
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                placeholder="Describe the mission, constraints, and desired outcome."
                className="min-h-[180px] w-full resize-none bg-[var(--theme-card)] px-6 py-5 text-base text-[var(--theme-text)] outline-none placeholder:text-[var(--theme-muted-2)]"
              />
              <div className="flex flex-col gap-3 border-t border-[var(--theme-border)] px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        setSelectedAction(action.id)
                        setGoalDraft(action.prompt)
                      }}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        selectedAction === action.id
                          ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft-strong)] text-[var(--theme-accent-strong)]'
                          : 'border-[var(--theme-border2)] bg-[var(--theme-card)] text-[var(--theme-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]',
                      )}
                    >
                      <HugeiconsIcon icon={action.icon} size={14} strokeWidth={1.7} />
                      {action.label}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={!goalDraft.trim() || conductor.isSending}
                  className="min-w-[140px] rounded-xl bg-[var(--theme-accent)] text-white hover:bg-[var(--theme-accent-strong)]"
                >
                  {conductor.isSending ? 'Dispatching...' : 'Launch Mission'}
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.7} />
                </Button>
              </div>
            </section>
          </div>
        </main>
      </div>
    )
  }

  if (phase === 'preview') {
    return (
      <div className="h-full min-h-full bg-[var(--theme-bg)] text-[var(--theme-text)]" style={THEME_STYLE}>
        <main className="mx-auto flex min-h-full max-w-[880px] flex-col px-6 py-12">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--theme-accent)]">Mission Decomposition</p>
              <h1 className="text-2xl font-semibold tracking-tight">{conductor.goal}</h1>
              <p className="text-sm text-[var(--theme-muted-2)]">
                Aurora is breaking the mission into workers. Once they spawn, this view flips into the active board.
              </p>
            </div>

            <section className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--theme-border)] pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">Live Stream</p>
                  <p className="mt-1 text-xs text-[var(--theme-muted-2)]">Streaming from /api/send-stream</p>
                </div>
                <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
                  Decomposing
                </span>
              </div>
              <div className="mt-4 min-h-[320px] rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                {conductor.streamText ? (
                  <Markdown className="max-w-none text-sm text-[var(--theme-text)]">
                    {conductor.streamText}
                  </Markdown>
                ) : (
                  <p className="text-sm text-[var(--theme-muted)]">Waiting for Aurora to respond…</p>
                )}
              </div>
              {conductor.streamError && (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {conductor.streamError}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div className="h-full min-h-full bg-[var(--theme-bg)] text-[var(--theme-text)]" style={THEME_STYLE}>
        <main className="mx-auto flex min-h-full max-w-[960px] flex-col px-6 py-12">
          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--theme-muted)]">Mission Complete</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight">{conductor.goal}</h1>
                  <p className="mt-2 text-sm text-[var(--theme-muted-2)]">
                    {completedWorkers}/{Math.max(totalWorkers, completedWorkers)} workers finished · {formatElapsedTime(conductor.missionStartedAt, now)} total elapsed
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={conductor.resetMission}
                    className="rounded-xl border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] hover:bg-[var(--theme-card2)]"
                  >
                    New Mission
                  </Button>
                </div>
              </div>
            </div>

            <section className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">Aurora Summary</p>
                  <p className="mt-1 text-xs text-[var(--theme-muted-2)]">Final streamed response from the main session.</p>
                </div>
                <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  Complete
                </span>
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                {conductor.streamText ? (
                  <Markdown className="max-w-none text-sm text-[var(--theme-text)]">{conductor.streamText}</Markdown>
                ) : (
                  <p className="text-sm text-[var(--theme-muted)]">No streamed summary captured.</p>
                )}
              </div>
            </section>

            {completePhaseProjectPath && (
              <section className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">Output Preview</p>
                    <p className="mt-1 text-xs text-[var(--theme-muted-2)]">Previewing {completePhaseProjectPath}/index.html</p>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-white">
                  <iframe
                    src={`/api/preview-file?path=${encodeURIComponent(`${completePhaseProjectPath}/index.html`)}`}
                    className="h-[400px] w-full"
                    sandbox="allow-scripts"
                    title="Mission output preview"
                  />
                </div>
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">Workers Summary</h2>
              </div>
              <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-4">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-[var(--theme-muted)]">{conductor.workers.length} worker{conductor.workers.length !== 1 ? 's' : ''} ran</span>
                  <span className="text-[var(--theme-muted)]">·</span>
                  <span className="text-[var(--theme-muted)]">{conductor.workers.reduce((sum, w) => sum + w.totalTokens, 0).toLocaleString()} total tokens</span>
                  <span className="text-[var(--theme-muted)]">·</span>
                  <span className="text-[var(--theme-muted)]">{conductor.workers.map(w => w.model).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Unknown'}</span>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-full flex-col overflow-hidden bg-[var(--theme-bg)] text-[var(--theme-text)]" style={THEME_STYLE}>
      <div className="border-b border-[var(--theme-border)] bg-[var(--theme-card)]/70 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-muted-2)]">Conductor</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-[var(--theme-text)]">{conductor.goal}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-1 text-xs font-medium text-[var(--theme-muted)]">
              Elapsed: {formatElapsedTime(conductor.missionStartedAt, now)}
            </span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              {completedWorkers}/{Math.max(totalWorkers, 1)} · {missionProgress}%
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={conductor.resetMission}
              className="rounded-xl border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] hover:bg-[var(--theme-card2)]"
            >
              Leave Mission
            </Button>
          </div>
        </div>
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-h-0 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
            <div className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--theme-border)] pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">Aurora Live Plan</p>
                  <p className="mt-1 text-xs text-[var(--theme-muted-2)]">Streaming decomposition from the main gateway chat session.</p>
                </div>
                <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
                  Running
                </span>
              </div>
              <div className="mt-4 min-h-[220px] rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
                {conductor.streamText ? (
                  <Markdown className="max-w-none text-sm text-[var(--theme-text)]">{conductor.streamText}</Markdown>
                ) : (
                  <p className="text-sm text-[var(--theme-muted)]">Waiting for the first streamed response…</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">Worker Sessions</h2>
                <span className="text-xs text-[var(--theme-muted-2)]">Polling /api/sessions every 3s</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {conductor.workers.map((worker) => {
                  const dot = getWorkerDot(worker.status)
                  const isSelected = selectedWorkerKey === worker.key
                  return (
                    <button
                      key={worker.key}
                      type="button"
                      onClick={() => setSelectedWorkerKey(worker.key)}
                      className={cn(
                        'rounded-2xl border bg-[var(--theme-card)] px-4 py-4 text-left transition-colors hover:border-[var(--theme-accent)]',
                        isSelected ? 'border-[var(--theme-accent)] ring-1 ring-[var(--theme-accent)]/35' : 'border-[var(--theme-border)]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('size-2.5 rounded-full', dot.dotClass)} />
                            <p className="truncate text-sm font-medium text-[var(--theme-text)]">{worker.label}</p>
                          </div>
                          <p className="mt-1 text-xs text-[var(--theme-muted-2)]">{worker.displayName}</p>
                        </div>
                        <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
                          {dot.label}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
                          <p className="text-[var(--theme-muted)]">Model</p>
                          <p className="mt-1 truncate text-[var(--theme-text)]">{worker.model ?? 'Unknown'}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
                          <p className="text-[var(--theme-muted)]">Tokens</p>
                          <p className="mt-1 text-[var(--theme-text)]">{worker.tokenUsageLabel}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
                          <p className="text-[var(--theme-muted)]">Elapsed</p>
                          <p className="mt-1 text-[var(--theme-text)]">{formatElapsedTime(conductor.missionStartedAt, now)}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2">
                          <p className="text-[var(--theme-muted)]">Last update</p>
                          <p className="mt-1 text-[var(--theme-text)]">{formatRelativeTime(worker.updatedAt, now)}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {conductor.workers.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-8 text-center text-sm text-[var(--theme-muted)] md:col-span-2">
                    Waiting for sub-agents to appear… if Aurora is still planning, this is normal.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="border-t border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-6 lg:border-l lg:border-t-0">
          {selectedWorker ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">Worker Output</p>
                  <p className="mt-2 truncate text-lg font-semibold text-[var(--theme-text)]">{selectedWorker.label}</p>
                  <p className="mt-1 text-xs text-[var(--theme-muted-2)]">{selectedWorker.displayName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedWorkerKey(null)}
                  className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card2)] p-2 text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                  aria-label="Close worker output"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.8} />
                </button>
              </div>

              <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card2)] p-4">
                <p className="text-xs text-[var(--theme-muted)]">Status</p>
                <p className="mt-1 text-xl font-semibold text-[var(--theme-text)]">{getWorkerDot(selectedWorker.status).label}</p>
              </div>

              <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-4">
                {workerHistoryQuery.isLoading ? (
                  <p className="text-sm text-[var(--theme-muted)]">Loading worker output…</p>
                ) : workerHistoryQuery.error ? (
                  <p className="text-sm text-red-300">{workerHistoryQuery.error instanceof Error ? workerHistoryQuery.error.message : 'Failed to load worker output.'}</p>
                ) : selectedWorkerOutput ? (
                  <Markdown className="max-w-none text-sm text-[var(--theme-text)]">{selectedWorkerOutput}</Markdown>
                ) : (
                  <p className="text-sm text-[var(--theme-muted)]">No assistant output yet.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">Progress</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--theme-text)]">{completedWorkers}/{totalWorkers}</p>
              </div>
              <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card2)] p-4">
                <p className="text-xs text-[var(--theme-muted)]">Phase</p>
                <p className="mt-1 text-xl font-semibold capitalize text-[var(--theme-text)]">Running</p>
              </div>
              <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card2)] p-4">
                <p className="text-xs text-[var(--theme-muted)]">Active Workers</p>
                <p className="mt-1 text-xl font-semibold text-[var(--theme-text)]">{conductor.activeWorkers.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card2)] p-4">
                <p className="text-xs text-[var(--theme-muted)]">Last Refresh</p>
                <p className="mt-1 text-xl font-semibold text-[var(--theme-text)]">
                  {conductor.isRefreshingWorkers ? 'Refreshing…' : formatRelativeTime(new Date(now).toISOString(), now)}
                </p>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}
