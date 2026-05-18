import router from '../router'

const TOKEN_KEY = 'api_token'
const USERNAME_KEY = 'login_username'

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USERNAME_KEY)
    router.push('/login')
  }
  return res
}
