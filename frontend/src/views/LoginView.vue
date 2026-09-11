<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <img src="https://i.ibb.co/3yBdJq67/IMG-9095.png" alt="Logo URE" class="login-logo" />
        <h1>Sistema de Chamados</h1>
        <p class="login-subtitle">URE Leste 3 · Acesso seguro</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email" class="form-label">E-mail institucional</label>
          <Input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="seu.email@educacao.sp.gov.br"
            :error="errors.email"
            @blur="validateField('email')"
          />
        </div>

        <div class="form-group">
          <label for="senha" class="form-label">Senha</label>
          <Input
            id="senha"
            v-model="form.senha"
            type="password"
            placeholder="Sua senha"
            :error="errors.senha"
            @blur="validateField('senha')"
          />
        </div>

        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

        <Button type="submit" variant="primary" size="lg" class="login-submit" :loading="loading">
          Entrar
        </Button>
      </form>

      <p class="login-footer">Esqueceu a senha? Contate o administrador do sistema.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const ui = useUIStore()

const form = reactive({ email: '', senha: '' })
const errors = reactive({ email: '', senha: '' })
const errorMessage = ref('')
const loading = ref(false)

function validateField(field: 'email' | 'senha') {
  if (field === 'email' && !form.email) {
    errors.email = 'Informe seu e-mail'
  } else if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'E-mail inválido'
  } else {
    errors.email = ''
  }

  if (field === 'senha' && !form.senha) {
    errors.senha = 'Informe sua senha'
  } else {
    errors.senha = ''
  }
}

async function handleLogin() {
  validateField('email')
  validateField('senha')

  if (errors.email || errors.senha || !form.email || !form.senha) return

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await auth.login({ email: form.email, senha: form.senha })

    if (result.primeiroLogin) {
      ui.showToast('info', 'Primeiro acesso detectado. Defina sua nova senha.')
      await router.push({ name: 'trocar-senha' })
    } else {
      const redirect = route.query.redirect as string || '/matriz'
      await router.push(redirect)
    }
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Credenciais inválidas'
    ui.showToast('error', errorMessage.value)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background: radial-gradient(ellipse 700px 500px at 50% 40%, rgba(59, 130, 246, 0.08), transparent 60%), var(--bg-primary);
}

.login-container {
  width: 100%;
  max-width: 400px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-lg);
}

.login-header { text-align: center; margin-bottom: var(--spacing-xl); }

.login-logo { height: 80px; margin-bottom: var(--spacing-md); }

.login-container h1 {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin-bottom: var(--spacing-xs);
}

.login-subtitle { color: var(--text-secondary); font-size: var(--font-size-sm); }

.login-form { display: flex; flex-direction: column; gap: var(--spacing-md); }

.form-group { display: flex; flex-direction: column; gap: var(--spacing-xs); }

.form-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.form-error {
  font-size: var(--font-size-sm);
  color: var(--accent-danger);
  text-align: center;
  padding: var(--spacing-sm);
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-md);
}

.login-submit { width: 100%; margin-top: var(--spacing-sm); }

.login-footer {
  margin-top: var(--spacing-lg);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}
</style>