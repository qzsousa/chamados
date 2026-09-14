import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/client'
import type { Chamado, FiltrosChamado, CriarChamado, AtualizarStatusChamado, ResponderChamado, BatchUpdateChamados, BatchDeleteChamados, DashboardKPIs, DashboardMatrizResponse, DashboardFiltradoResponse } from '../../../shared/types/api'

export const useChamadosStore = defineStore('chamados', () => {
  const lista = ref<Chamado[]>([])
  const filtros = ref<FiltrosChamado>({ page: 1, limit: 20 })
  const loading = ref(false)
  const stats = ref<DashboardKPIs>({ total: 0, abertos: 0, andamento: 0, comunicado: 0, resolvidos: 0, altaPrioridade: 0 })
  const graficos = ref<{ porStatus: Record<string, number>; porUrgencia: Record<string, number>; resolvidosPorTecnico: Record<string, number> }>({ porStatus: {}, porUrgencia: {}, resolvidosPorTecnico: {} })
  const avisos = ref<any[]>([])
  const inventario = ref<{ unidade: string; tecnicoSetor: string; status: string | null } | null>(null)

  async function carregar(novosFiltros?: FiltrosChamado) {
    loading.value = true
    try {
      if (novosFiltros) filtros.value = { ...filtros.value, ...novosFiltros }
      const params = new URLSearchParams()
      Object.entries(filtros.value).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== null) params.append(k, String(v))
      })
      const { data } = await api.get<{ data: Chamado[]; meta: any }>(`/chamados?${params}`)
      lista.value = data.data
    } finally {
      loading.value = false
    }
  }

  async function criar(dados: CriarChamado) {
    const { data } = await api.post<Chamado>('/chamados', dados)
    lista.value.unshift(data)
    return data
  }

  async function buscar(id: string) {
    const { data } = await api.get<Chamado>(`/chamados/${id}`)
    return data
  }

  async function atualizarStatus(id: string, payload: AtualizarStatusChamado) {
    const { data } = await api.patch<Chamado>(`/chamados/${id}/status`, payload)
    const idx = lista.value.findIndex((c: Chamado) => c.id === id)
    if (idx > -1) lista.value[idx] = data
    return data
  }

  async function responder(id: string, payload: ResponderChamado) {
    const { data } = await api.post<Chamado>(`/chamados/${id}/resposta`, payload)
    const idx = lista.value.findIndex((c: Chamado) => c.id === id)
    if (idx > -1) lista.value[idx] = data
    return data
  }

  async function deletar(id: string) {
    await api.delete(`/chamados/${id}`)
    lista.value = lista.value.filter((c: Chamado) => c.id !== id)
  }

  async function atualizarLote(payload: BatchUpdateChamados) {
    const { data } = await api.patch<{ atualizados: number }>('/chamados/batch', payload)
    await carregar()
    return data
  }

  async function deletarLote(payload: BatchDeleteChamados) {
    const { data } = await api.delete<{ removidos: number }>('/chamados/batch', { data: payload })
    await carregar()
    return data
  }

  async function deletar(id: string) {
    const { data } = await api.delete<{ success: boolean }>(`/chamados/${id}`)
    lista.value = lista.value.filter((c) => c.id !== id)
    return data
  }

  async function carregarMatriz() {
    loading.value = true
    try {
      const { data } = await api.get<DashboardMatrizResponse>('/dashboard/matriz')
      stats.value = data.kpis
      lista.value = data.chamados
      graficos.value = data.graficos
    } finally {
      loading.value = false
    }
  }

  async function carregarFiltrado() {
    loading.value = true
    try {
      const { data } = await api.get<DashboardFiltradoResponse>('/dashboard/filtrado')
      stats.value = data.kpis
      lista.value = data.chamados
      avisos.value = data.avisos || []
      inventario.value = data.inventario
    } finally {
      loading.value = false
    }
  }

  async function carregarStats() {
    const { data } = await api.get<DashboardKPIs>('/dashboard/stats')
    stats.value = data
  }

return {
    lista,
    filtros,
    loading,
    stats,
    graficos,
    avisos,
    inventario,
    carregar,
    criar,
    buscar,
    atualizarStatus,
    responder,
    atualizarLote,
    deletarLote,
    deletar,
    carregarMatriz,
    carregarFiltrado,
    carregarStats
  }
})