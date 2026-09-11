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

    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login') {
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
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken }, { withCredentials: true })
        authStore.setTokens(data.accessToken, data.refreshToken)
        processQueue(data.accessToken, null)
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        }
        return api(originalRequest)
      } catch (err) {
        processQueue(null, err as Error)
        const authStore = getAuthStore()
        authStore.logout()
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api