import { generate } from '../../src/utils/generate'

const UPSTREAM = 'https://proxiedmail.com'
const ALWAYS_AVAILABLE_DOMAINS = new Set(['pdxmail.net', 'pdxmail.com', 'proxiedmail.com'])

interface ProxyInfo {
  proxy: string
  real_addresses: string[] | Record<string, unknown>
}

async function fetchAllRemoteProxies(token: string): Promise<ProxyInfo[]> {
  const resp = await fetch(`${UPSTREAM}/api/v1/proxy-bindings`, {
    headers: { Token: token, 'Content-Type': 'application/json' },
    method: 'GET',
  })
  if (!resp.ok) throw new Error(`Failed to fetch proxies: ${resp.status}`)
  const data = await resp.json() as {
    data?: Array<{
      attributes?: {
        proxy_address?: string
        real_addresses?: string[] | Record<string, unknown>
      }
    }>
  }
  if (!data.data) return []
  return data.data
    .map(pb => ({
      proxy: pb.attributes?.proxy_address ?? '',
      real_addresses: pb.attributes?.real_addresses ?? [],
    }))
    .filter(p => p.proxy)
}

async function fetchAvailableDomains(token: string): Promise<Set<string>> {
  const domains = new Set(ALWAYS_AVAILABLE_DOMAINS)
  const resp = await fetch(`${UPSTREAM}/gapi/custom-domains?ignoreProcessing=1`, {
    headers: { Token: token },
  })
  if (!resp.ok) return domains
  const data = await resp.json() as Array<{ domain?: string }>
  if (Array.isArray(data)) {
    for (const d of data) {
      if (d.domain) domains.add(d.domain)
    }
  }
  return domains
}

async function createProxyBinding(
  proxyAddress: string,
  description: string | undefined,
  token: string,
  realAddress: string,
): Promise<Response> {
  return fetch(`${UPSTREAM}/api/v1/proxy-bindings`, {
    method: 'POST',
    headers: { Token: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        type: 'proxy_bindings',
        attributes: { proxy_address: proxyAddress, description, real_addresses: [realAddress] },
      },
    }),
  })
}

export const onRequest: PagesFunction = async (context) => {
  const { request, waitUntil } = context

  if (request.method !== 'POST') {
    return new Response('Not Found', { status: 404 })
  }

  const auth = request.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response('Missing or invalid Authorization header', { status: 401 })
  }
  const token = auth.replace('Bearer ', '').trim()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return new Response('Invalid JSON', { status: 400 })
  }
  const { domain, description } = body as { domain?: unknown; description?: string }

  if (!domain || typeof domain !== 'string') {
    return new Response('Missing or invalid domain', { status: 400 })
  }

  let existingProxies: ProxyInfo[]
  let availableDomains: Set<string>
  try {
    ;[existingProxies, availableDomains] = await Promise.all([
      fetchAllRemoteProxies(token),
      fetchAvailableDomains(token),
    ])
  } catch (err) {
    return new Response(`Failed to fetch existing proxies: ${err}`, { status: 500 })
  }

  if (!availableDomains.has(domain)) {
    return new Response(`Domain '${domain}' is not available`, { status: 422 })
  }

  const existingAddresses = new Set(existingProxies.map(p => p.proxy))

  let realAddress: string | null = null
  for (const p of existingProxies) {
    const ra = p.real_addresses
    if (Array.isArray(ra)) {
      realAddress = ra[0] ?? null
    } else if (typeof ra === 'object' && ra !== null) {
      realAddress = Object.keys(ra)[0] ?? null
    }
    if (realAddress) break
  }

  if (!realAddress) {
    return new Response('No existing proxy with a real address found', { status: 503 })
  }

  let localPart!: string
  let fullEmail!: string
  let attempts = 0
  do {
    const given = generate('given') + (Math.random() < 0.5 ? '' : `.${generate('given')}`)
    const surname = generate('surname') + (Math.random() < 0.5 ? '' : `-${generate('surname')}`)
    localPart = `${given}.${surname}`.toLowerCase()
    fullEmail = `${localPart}@${domain}`
    attempts++
  } while (existingAddresses.has(fullEmail) && attempts < 20)

  if (existingAddresses.has(fullEmail)) {
    return new Response('Could not generate a unique proxy address', { status: 500 })
  }

  const captured = realAddress
  waitUntil((async () => {
    await createProxyBinding(fullEmail, description, token, captured)
  })())

  return new Response(
    JSON.stringify({
      data: { local_part: localPart, domain, email: fullEmail, active: true },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
