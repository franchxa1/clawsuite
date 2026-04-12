import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/gateway')({
  ssr: false,
  component: function GatewayLayoutRoute() {
    return <Outlet />
  },
})
