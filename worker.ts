type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher
}

const apiPrefixes = ['/api/v1/', '/gapi/']
const upstreamOrigin = 'https://proxiedmail.com'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
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
