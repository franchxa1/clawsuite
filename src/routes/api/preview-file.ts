import { existsSync, readFileSync } from 'node:fs'
import { extname, normalize } from 'node:path'
import { createFileRoute } from '@tanstack/react-router'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

function isAllowedPreviewPath(filePath: string): boolean {
  const normalized = normalize(filePath)
  return normalized.startsWith('/tmp/')
}

export const Route = createFileRoute('/api/preview-file')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const filePath = url.searchParams.get('path') ?? ''

        if (!isAllowedPreviewPath(filePath)) {
          return new Response('Forbidden', { status: 403 })
        }

        if (!existsSync(filePath)) {
          return new Response('Not found', { status: 404 })
        }

        const contentType = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'text/plain; charset=utf-8'
        const body = readFileSync(filePath)

        return new Response(body, {
          headers: {
            'content-type': contentType,
            'cache-control': 'no-store',
          },
        })
      },
    },
  },
})
