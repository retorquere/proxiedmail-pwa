type AssetFetcher = {
  fetch(request: Request): Promise<Response>
}

interface Env {
  ASSETS: AssetFetcher
}

const apiPrefixes = ['/api/v1/', '/gapi/']
const upstreamOrigin = 'https://proxiedmail.com'

function loginBootstrap(token: string): Response {
  const serializedToken = JSON.stringify(token).replace(/</g, '\\u003c')
  return new Response(`<!doctype html><meta charset="utf-8"><script>
    localStorage.setItem('proxiedmail.apiToken', ${serializedToken});
    localStorage.removeItem('proxiedmail.bearerToken');
    location.replace('/');
  </script>`, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'",
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/login' && request.method === 'POST') {
      const contentType = request.headers.get('Content-Type') || ''
      const body = contentType.includes('application/json')
        ? await request.json() as { token?: string; apiToken?: string; password?: string }
        : Object.fromEntries(new URLSearchParams(await request.text())) as { token?: string; apiToken?: string; password?: string }
      const token = String(body.token || body.apiToken || body.password || '').trim().replace(/^Token\s+/i, '')
      if (!token || /[\s()]/.test(token)) {
        return new Response('A valid API token is required.', { status: 400 })
      }
      return loginBootstrap(token)
    }

    if (apiPrefixes.some(prefix => url.pathname.startsWith(prefix))) {
      const upstreamUrl = `${upstreamOrigin}${url.pathname}${url.search}`
      const headers = new Headers(request.headers)
      headers.delete('Host')
      const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body
      const response = await fetch(upstreamUrl, { method: request.method, headers, body, redirect: 'follow' })
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers })
    }

    return env.ASSETS.fetch(request)
  },
}
