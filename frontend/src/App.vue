<template>
  <div class="app">
    <div class="maintenance-banner">Aviso: o sistema estará em manutenção das 16:30 às 19:30.</div>
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import ToastContainer from '@/components/ui/ToastContainer.vue'
</script>

<style>
.app {
  min-height: 100vh;
}
.maintenance-banner {
  background: #fff3cd;
  color: #856404;
  padding: 10px 16px;
  text-align: center;
  font-size: 0.9rem;
  border-bottom: 1px solid #ffeeba;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>