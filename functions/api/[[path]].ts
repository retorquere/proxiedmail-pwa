const UPSTREAM = 'https://proxiedmail.com'

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const target = `${UPSTREAM}${url.pathname}${url.search}`

  const req = new Request(target, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
    redirect: 'follow',
  })

  return fetch(req)
}
