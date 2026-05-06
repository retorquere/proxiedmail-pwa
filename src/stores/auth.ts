import { defineStore } from 'pinia'
import { ref } from 'vue'

const TOKEN_KEY = 'api_token'
const USERNAME_KEY = 'login_username'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const loginUsername = ref<string | null>(localStorage.getItem(USERNAME_KEY))

  function setToken(t: string) {
    token.value = t
    localStorage.setItem(TOKEN_KEY, t)
  }

  function clearToken() {
    token.value = null
    loginUsername.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USERNAME_KEY)
  }

  async function login(username: string, password: string): Promise<void> {
    // Step 1: POST /api/v1/auth to get OAuth access token
    const authRes = await fetch('/api/v1/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          type: 'auth-request',
          attributes: { username, password },
        },
      }),
    })

    const authText = await authRes.text()

    if (!authRes.ok) {
      let msg = 'Invalid credentials'
      try {
        msg = JSON.parse(authText)?.[0]?.data?.attributes?.message ?? msg
      }
      catch {}
      throw new Error(msg)
    }

    const authData = JSON.parse(authText)
    const oauthToken: string = authData.data.attributes.token

    const tokenRes = await fetch('/api/v1/api-token', {
      headers: { Authorization: `Bearer ${oauthToken}` },
    })

    const tokenText = await tokenRes.text()

    if (!tokenRes.ok) {
      throw new Error('Failed to retrieve API token')
    }

    const tokenData = JSON.parse(tokenText)
    setToken(tokenData.token)
    loginUsername.value = username
    localStorage.setItem(USERNAME_KEY, username)
  }

  return { token, loginUsername, login, clearToken }
})
