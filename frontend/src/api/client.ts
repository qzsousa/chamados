import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: Error) => void }> = []

function getAuthStore() {
  return useAuthStore()
}

function processQueue(token: string | null, error: Error | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token!)
  })
  failedQueue = []
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const authStore = getAuthStore()
  if (authStore.accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${authStore.accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Não intercepta chamadas de auth nem a própria rota de refresh (evita loops)
    if (originalRequest.url === '/auth/refresh' || originalRequest.url === '/auth/login') {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`
          }
          return api(originalRequest)
        }).catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const authStore = getAuthStore()
        const refreshToken = localStorage.getItem('refreshToken') || ''
        if (!refreshToken) {
          // Sem refresh token: faz logout silencioso sem chamar /auth/logout
          localStorage.removeItem('accessToken')
          authStore.logout()
          return Promise.reject(error)
        }
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken }, { withCredentials: true })
        authStore.setTokens(data.accessToken, data.refreshToken)
        processQueue(data.accessToken, null)
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        }
        return api(originalRequest)
      } catch (err) {
        processQueue(null, err as Error)
        // Só desloga quando o refresh é RECUSADO de fato (401/403).
        // Erros de rede/5xx (cold start do Render, deploy em andamento)
        // não devem derrubar a sessão do usuário.
        const status = (err as AxiosError).response?.status
        if (status === 401 || status === 403) {
          const authStore = getAuthStore()
          authStore.logout()
        }
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api