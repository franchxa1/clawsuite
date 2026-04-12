import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/logs')({
  ssr: false,
  beforeLoad: function redirectLegacyLogsRoute() {
    throw redirect({
      to: '/activity',
      replace: true,
    })
  },
  component: function LogsRoute() {
    return null
  },
})
