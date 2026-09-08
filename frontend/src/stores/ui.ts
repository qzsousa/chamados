import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export const useUIStore = defineStore('ui', () => {
  const loading = ref(false)
  const toasts = ref<Toast[]>([])
  const modals = ref<Record<string, boolean>>({})

  function showToast(type: Toast['type'], message: string) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`
    toasts.value.push({ id, type, message })
    setTimeout(() => removeToast(id), 4000)
  }

  function removeToast(id: string) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx > -1) toasts.value.splice(idx, 1)
  }

  function openModal(name: string) {
    modals.value[name] = true
  }

  function closeModal(name: string) {
    modals.value[name] = false
  }

  function setLoading(value: boolean) {
    loading.value = value
  }

  return {
    loading,
    toasts,
    modals,
    showToast,
    removeToast,
    openModal,
    closeModal,
    setLoading
  }
})