<template>
  <div class="input-wrapper">
    <label v-if="label" :for="id" class="input-label">{{ label }}</label>
    <div class="input-group" :class="{ 'input-group--with-icon': !!icon }">
      <component v-if="icon" :is="icon" class="input-icon" />
      <input
        :id="id"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${id}-error` : undefined"
        @input="$emit('update:modelValue', $event.target.value)"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
        class="input-field"
      />
    </div>
    <p v-if="error" :id="`${id}-error`" class="input-error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="input-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: string
  id: string
  label?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  error?: string
  hint?: string
  icon?: any
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  readonly: false,
  required: false
})

defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()
</script>

<style scoped>
.input-wrapper { display: flex; flex-direction: column; gap: var(--spacing-xs); }

.input-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.input-group { position: relative; display: flex; align-items: center; }

.input-icon {
  position: absolute;
  left: var(--spacing-md);
  width: 18px;
  height: 18px;
  color: var(--text-muted);
  pointer-events: none;
  flex-shrink: 0;
}

.input-field {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  padding-left: var(--spacing-md);
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: inherit;
  transition: all var(--transition-fast);
}

.input-group--with-icon .input-field { padding-left: 40px; }

.input-field:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.input-field:disabled { opacity: 0.5; cursor: not-allowed; background: var(--bg-tertiary); }

.input-field::placeholder { color: var(--text-muted); }

.input-field[aria-invalid="true"] { border-color: var(--accent-danger); }

.input-error { font-size: var(--font-size-xs); color: var(--accent-danger); margin: 0; }
.input-hint { font-size: var(--font-size-xs); color: var(--text-muted); margin: 0; }
</style>