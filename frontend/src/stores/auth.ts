import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'
import type { User, LoginResponse, LoginRequest, ChangePassword } from '../../../shared/types/api'
import type { AxiosInstance } from 'axios'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const isLoading = ref(false)
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => !!accessToken.value)
  const isAdmin = computed(() => user.value?.nivel === 'ADMIN')
  const mustChangePassword = computed(() => user.value?.primeiroLogin === true)

  function setTokens(newAccessToken: string, newRefreshToken: string) {
    accessToken.value = newAccessToken
    if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken)
  }

  async function initialize() {
    if (isInitialized.value) return

    const savedToken = localStorage.getItem('accessToken')
    if (savedToken) {
      accessToken.value = savedToken
      try {
        await fetchMe()
      } catch {
        logout()
      }
    }
    isInitialized.value = true
  }

  async function login(credentials: LoginRequest): Promise<LoginResponse> {
    isLoading.value = true
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', credentials)
      accessToken.value = data.accessToken
      user.value = data.user
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      return data
    } finally {
      isLoading.value = false
    }
  }

  async function fetchMe() {
    if (!accessToken.value) throw new Error('No token')
    const { data } = await api.get<User>('/auth/me')
    user.value = data
  }

  async function refresh() {
    const refreshToken = localStorage.getItem('refreshToken') || ''
    const { data } = await api.post<LoginResponse>('/auth/refresh', { refreshToken })
    accessToken.value = data.accessToken
    user.value = data.user
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    return data
  }

  async function changePassword(payload: ChangePassword) {
    isLoading.value = true
    try {
      await api.post('/auth/change-password', payload)
      await logout()
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore
    } finally {
      accessToken.value = null
      user.value = null
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }
  }

  async function gerarSenhaTemporaria(email: string): Promise<string> {
    const { data } = await api.post<{ senhaTemporaria: string }>('/auth/admin/gerar-senha-temporaria', { email })
    return data.senhaTemporaria
  }

  return {
    user,
    accessToken,
    isLoading,
    isInitialized,
    isAuthenticated,
    isAdmin,
    mustChangePassword,
    initialize,
    login,
    fetchMe,
    refresh,
    changePassword,
    logout,
    setTokens,
    gerarSenhaTemporaria,
    axios: api as AxiosInstance
  }
})