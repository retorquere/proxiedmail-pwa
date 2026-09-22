type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

interface Env {
  ASSETS: AssetFetcher;
  ALLOWED_ORIGIN?: string;
}

const apiPrefixes = ['/api/v1/', '/gapi/'];
const upstreamOrigin = 'https://proxiedmail.com';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (apiPrefixes.some((prefix) => url.pathname.startsWith(prefix))) {
      return proxyApiRequest(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function proxyApiRequest(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  const upstreamUrl = `${upstreamOrigin}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete('Host');
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body;
  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    redirect: 'follow',
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  for (const [name, value] of Object.entries(corsHeaders(request, env))) {
    responseHeaders.set(name, value);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGIN;
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Accept,Content-Type,Authorization,Token',
    Vary: 'Origin',
  };

  if (allowedOrigin && (!origin || origin === allowedOrigin)) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }

  return headers;
}