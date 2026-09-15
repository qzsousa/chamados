import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/chamado/novo'
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true }
  },
  {
    path: '/trocar-senha',
    name: 'trocar-senha',
    component: () => import('@/views/TrocarSenhaView.vue'),
    meta: { requiresAuth: true, forcePasswordChange: true }
  },
  {
    path: '/matriz',
    name: 'matriz',
    component: () => import('@/views/DashboardMatrizView.vue'),
    meta: { public: true }
  },
  {
    path: '/dirigente',
    name: 'dirigente',
    component: () => import('@/views/DashboardDirigenteView.vue'),
    meta: { public: true }
  },
  {
    path: '/chamado/novo',
    name: 'novo-chamado',
    component: () => import('@/views/FormsView.vue'),
    meta: { public: true }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardFiltradoView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/usuarios',
    name: 'admin-usuarios',
    component: () => import('@/views/AdminUsuariosView.vue'),
    meta: { requiresAuth: true, roles: ['ADMIN'] }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/matriz'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  if (!authStore.isInitialized) {
    await authStore.initialize()
  }

  const isPublic = to.meta.public === true
  const requiresAuth = to.meta.requiresAuth === true
  const forcePasswordChange = to.meta.forcePasswordChange === true
  const allowedRoles = to.meta.roles as string[] | undefined

  if (!isPublic && !authStore.isAuthenticated) {
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  if (requiresAuth && authStore.isAuthenticated) {
    if (forcePasswordChange && authStore.mustChangePassword && to.name !== 'trocar-senha') {
      return next({ name: 'trocar-senha' })
    }

    if (allowedRoles && !allowedRoles.includes(authStore.user?.nivel || '')) {
      return next({ name: 'dashboard' })
    }
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    return next({ name: 'matriz' })
  }

  next()
})

export default router