import {
  ArrowRight01Icon,
  GlobeIcon,
  PlayCircleIcon,
  Search01Icon,
  WaveIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'

const highlights = [
  {
    label: 'Top speed',
    value: '20 mph',
    detail: 'Common dolphins can sprint through wake lines with startling ease.',
  },
  {
    label: 'Social pods',
    value: '10 to 1,000',
    detail: 'Some species travel in small family groups, others form superpods.',
  },
  {
    label: 'Sleep style',
    value: 'Half-awake',
    detail: 'One brain hemisphere rests while the other keeps breathing on duty.',
  },
] as const

const storyCards = [
  {
    title: 'Built for echolocation',
    copy:
      'Dolphins map their surroundings with clicks and returning echoes, turning dark water into a detailed acoustic sketch.',
  },
  {
    title: 'Ocean intelligence',
    copy:
      'They coordinate hunts, mimic sounds, and recognize signature whistles that work a lot like names.',
  },
  {
    title: 'A living coastline',
    copy:
      'Healthy dolphin populations usually point to rich fisheries, cleaner water, and resilient marine habitats.',
  },
] as const

const species = [
  {
    name: 'Spinner Dolphin',
    trait: 'Aerial acrobat',
    description:
      'Known for corkscrew leaps that can rotate several times before reentry.',
  },
  {
    name: 'Bottlenose Dolphin',
    trait: 'Coastal icon',
    description:
      'Adaptable, curious, and often the species most people picture first.',
  },
  {
    name: 'Dusky Dolphin',
    trait: 'Cold-water surfer',
    description:
      'Thrives in cooler currents and often rides breaking waves near shore.',
  },
] as const

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      {
        title: 'Dolphins Atlas',
      },
      {
        name: 'description',
        content:
          'A cinematic one-page guide to dolphins, from echolocation and pod life to species highlights and ocean conservation.',
      },
    ],
  }),
  component: IndexRoute,
})

function IndexRoute() {
  return (
    <main className="min-h-full bg-surface px-4 pb-24 pt-5 text-primary-900 md:px-6 md:pt-8">
      <section className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="overflow-hidden rounded-[2rem] border border-primary-200 bg-[linear-gradient(140deg,rgba(247,250,252,0.98),rgba(211,237,245,0.98)_38%,rgba(156,214,230,0.92)_100%)] shadow-[0_20px_70px_rgba(43,84,110,0.14)]"
        >
          <div className="grid gap-10 px-6 py-8 md:px-10 md:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-14 lg:py-14">
            <div className="space-y-7">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.45 }}
                className="inline-flex items-center gap-3 rounded-full border border-primary-200/80 bg-surface/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary-700 backdrop-blur"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-900 text-primary-50">
                  <HugeiconsIcon icon={WaveIcon} className="size-4" />
                </span>
                Dolphins Atlas
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.45 }}
                className="space-y-4"
              >
                <h1 className="max-w-3xl font-serif text-5xl leading-[0.95] tracking-[-0.04em] text-primary-950 md:text-7xl">
                  The swift intelligence of the sea, rendered in light.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-primary-800 md:text-lg">
                  Dolphins are part navigator, part social strategist, part
                  aerial performer. This page traces how they listen, move,
                  travel, and shape the waters around them.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.45 }}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <Button
                  size="lg"
                  className="bg-primary-950 text-primary-50 hover:bg-primary-800"
                >
                  <HugeiconsIcon icon={Search01Icon} className="size-4" />
                  Explore the pod
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-300 bg-surface/60 backdrop-blur"
                >
                  <HugeiconsIcon icon={PlayCircleIcon} className="size-4" />
                  Watch their movement
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26, duration: 0.45 }}
                className="grid gap-3 md:grid-cols-3"
              >
                {highlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.5rem] border border-primary-200/80 bg-surface/62 p-4 backdrop-blur"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                      {item.label}
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-primary-950">
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-primary-700">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.6 }}
              className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-primary-200/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_34%),linear-gradient(180deg,rgba(20,81,102,0.95),rgba(22,119,148,0.88)_55%,rgba(191,235,245,0.9)_100%)] p-5 text-primary-50"
            >
              <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_65%)]" />
              <motion.div
                animate={{ x: [0, 18, 0], y: [0, -10, 0], rotate: [0, 1, 0] }}
                transition={{
                  duration: 10,
                  ease: 'easeInOut',
                  repeat: Infinity,
                }}
                className="absolute left-[12%] top-[28%] h-36 w-36 rounded-[48%_52%_58%_42%/50%_36%_64%_50%] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(178,228,240,0.9)_42%,rgba(38,116,146,0.96))] shadow-[20px_28px_50px_rgba(8,42,60,0.35)]"
              >
                <div className="absolute right-4 top-4 h-5 w-5 rounded-full bg-primary-950/70" />
                <div className="absolute -right-4 top-[45%] h-10 w-18 -translate-y-1/2 rounded-r-full bg-[linear-gradient(90deg,rgba(152,221,235,0.88),rgba(23,93,117,0.95))]" />
                <div className="absolute left-[42%] top-[-14px] h-12 w-8 -rotate-12 rounded-t-full bg-[linear-gradient(180deg,rgba(189,238,247,0.9),rgba(41,123,151,0.95))]" />
              </motion.div>
              <motion.div
                animate={{ x: [0, -14, 0], y: [0, 12, 0] }}
                transition={{
                  duration: 12,
                  ease: 'easeInOut',
                  repeat: Infinity,
                }}
                className="absolute bottom-[20%] right-[8%] h-24 w-24 rounded-full border border-white/30 bg-white/10 blur-[1px]"
              />
              <motion.div
                animate={{ y: [0, -18, 0], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute bottom-8 left-8 h-20 w-20 rounded-full border border-white/30 bg-white/10"
              />

              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                      Field note
                    </p>
                    <p className="mt-3 max-w-xs text-2xl font-semibold leading-tight tracking-[-0.03em]">
                      A dolphin hears the shape of the world before it sees it.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white/78">
                    Pacific arc
                  </div>
                </div>

                <div className="space-y-3 rounded-[1.75rem] border border-white/18 bg-primary-950/20 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-sm text-white/76">
                    <span>Current sequence</span>
                    <span>Three essentials</span>
                  </div>
                  <div className="space-y-2">
                    {storyCards.map((item, index) => (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + index * 0.08, duration: 0.35 }}
                        className="flex items-start gap-3 rounded-2xl border border-white/14 bg-white/8 p-3"
                      >
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/14 text-xs font-semibold text-white">
                          0{index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-white">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-white/76">
                            {item.copy}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.article
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="rounded-[2rem] border border-primary-200 bg-primary-50 p-6 shadow-[0_18px_48px_rgba(66,89,100,0.08)] md:p-8"
          >
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.24em] text-primary-600">
              <HugeiconsIcon icon={GlobeIcon} className="size-4" />
              Why dolphins matter
            </div>
            <h2 className="mt-4 max-w-xl font-serif text-4xl leading-tight tracking-[-0.04em] text-primary-950">
              They are not just charismatic. They are environmental signals.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-primary-700">
              When dolphin populations thrive, it often means prey webs are
              active, migration corridors remain open, and coastal ecosystems
              still have enough oxygen, quiet, and room to function.
            </p>
            <div className="mt-8 space-y-4">
              {storyCards.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.5rem] border border-primary-200 bg-surface p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-lg font-semibold text-primary-950">
                      {item.title}
                    </p>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-4 text-primary-500"
                    />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-primary-700">
                    {item.copy}
                  </p>
                </div>
              ))}
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="rounded-[2rem] border border-primary-200 bg-surface p-6 shadow-[0_18px_48px_rgba(66,89,100,0.08)] md:p-8"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-600">
                  Species spotlight
                </p>
                <h2 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.04em] text-primary-950">
                  Three personalities from one oceanic family.
                </h2>
              </div>
              <div className="hidden rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 md:block">
                Curated profile
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {species.map((item, index) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: index * 0.07 }}
                  className="group rounded-[1.6rem] border border-primary-200 bg-[linear-gradient(180deg,rgba(249,251,252,1),rgba(229,243,247,1))] p-4"
                >
                  <div className="flex h-36 items-end rounded-[1.25rem] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(135,206,225,0.45)_38%,rgba(29,116,145,0.95)_100%)] p-4 shadow-inner">
                    <div className="h-10 w-24 rounded-[48%_52%_56%_44%/52%_40%_60%_48%] bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(165,225,239,0.94)_48%,rgba(39,112,141,1))]" />
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                    {item.trait}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-primary-950">
                    {item.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-primary-700">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.article>
        </div>
      </section>
    </main>
  )
}
