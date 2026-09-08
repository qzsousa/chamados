<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <img src="https://i.ibb.co/3yBdJq67/IMG-9095.png" alt="Logo URE" class="login-logo" />
        <h1>{{ isFirstLogin ? 'Primeiro Acesso' : 'Trocar Senha' }}</h1>
        <p class="login-subtitle">{{ isFirstLogin ? 'Defina sua nova senha para continuar' : 'Digite sua senha atual e a nova senha' }}</p>
      </div>

      <form @submit.prevent="handleChange" class="login-form">
        <div v-if="!isFirstLogin" class="form-group">
          <label for="senhaAtual" class="form-label">Senha atual</label>
          <Input
            id="senhaAtual"
            v-model="form.senhaAtual"
            type="password"
            placeholder="Senha atual"
            :error="errors.senhaAtual"
            @blur="validateField('senhaAtual')"
          />
        </div>

        <div class="form-group">
          <label for="novaSenha" class="form-label">Nova senha</label>
          <Input
            id="novaSenha"
            v-model="form.novaSenha"
            type="password"
            placeholder="Nova senha (mín. 8 caracteres)"
            :error="errors.novaSenha"
            @blur="validateField('novaSenha')"
          />
          <p class="form-hint">Mín. 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 especial</p>
        </div>

        <div class="form-group">
          <label for="confirmarSenha" class="form-label">Confirmar nova senha</label>
          <Input
            id="confirmarSenha"
            v-model="form.confirmarSenha"
            type="password"
            placeholder="Confirme a nova senha"
            :error="errors.confirmarSenha"
            @blur="validateField('confirmarSenha')"
          />
        </div>

        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

        <Button type="submit" variant="primary" size="lg" class="login-submit" :loading="loading">
          {{ isFirstLogin ? 'Continuar' : 'Salvar' }}
        </Button>
      </form>

      <Button v-if="!isFirstLogin" variant="ghost" class="login-back" @click="goBack">
        ← Voltar
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { SPECIAL_CHARS_REGEX } from '@/utils/regex'

const router = useRouter()
const auth = useAuthStore()
const ui = useUIStore()

const isFirstLogin = auth.mustChangePassword

const form = reactive({
  senhaAtual: '',
  novaSenha: '',
  confirmarSenha: ''
})

const errors = reactive({ senhaAtual: '', novaSenha: '', confirmarSenha: '' })
const errorMessage = ref('')
const loading = ref(false)

const passwordErrors = computed(() => {
  const errs: string[] = []
  if (form.novaSenha.length < 8) errs.push('Mínimo 8 caracteres')
  if (!/[A-Z]/.test(form.novaSenha)) errs.push('1 maiúscula')
  if (!/[a-z]/.test(form.novaSenha)) errs.push('1 minúscula')
  if (!/[0-9]/.test(form.novaSenha)) errs.push('1 número')
  if (!SPECIAL_CHARS_REGEX.test(form.novaSenha)) errs.push('1 especial')
  return errs
})

function validateField(field: keyof typeof form) {
  if (field === 'senhaAtual' && !isFirstLogin && !form.senhaAtual) {
    errors.senhaAtual = 'Informe a senha atual'
  } else {
    errors.senhaAtual = ''
  }

  if (field === 'novaSenha') {
    if (!form.novaSenha) {
      errors.novaSenha = 'Informe a nova senha'
    } else if (passwordErrors.value.length > 0) {
      errors.novaSenha = passwordErrors.value.join(', ')
    } else {
      errors.novaSenha = ''
    }
  }

  if (field === 'confirmarSenha') {
    if (!form.confirmarSenha) {
      errors.confirmarSenha = 'Confirme a nova senha'
    } else if (form.confirmarSenha !== form.novaSenha) {
      errors.confirmarSenha = 'Senhas não conferem'
    } else {
      errors.confirmarSenha = ''
    }
  }
}

async function handleChange() {
  ['senhaAtual', 'novaSenha', 'confirmarSenha'].forEach(f => validateField(f as keyof typeof form))

  if (Object.values(errors).some(e => e) || !form.novaSenha || form.novaSenha !== form.confirmarSenha) return

  loading.value = true
  errorMessage.value = ''

  try {
    await auth.changePassword({
      senhaAtual: isFirstLogin ? form.novaSenha : form.senhaAtual,
      novaSenha: form.novaSenha
    })
    ui.showToast('success', 'Senha alterada com sucesso!')
    await router.push('/login')
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Erro ao alterar senha'
    ui.showToast('error', errorMessage.value)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/dashboard')
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

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  margin: var(--spacing-xs) 0 0;
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

.login-back { width: 100%; margin-top: var(--spacing-sm); }
</style>