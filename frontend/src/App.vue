<template>
  <div class="app">
    <div class="maintenance-banner">AVISO: o sistema estará em manutenção das 17:00 às 20:00.</div>
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
  background: #d32f2f;
  color: #fff;
  padding: 14px 16px;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  border-bottom: 2px solid #b71c1c;
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