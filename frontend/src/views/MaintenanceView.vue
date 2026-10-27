<template>
  <div class="maintenance-page">
    <div class="maintenance-card">
      <img src="https://i.ibb.co/3yBdJq67/IMG-9095.png" alt="Logo URE" width="72" height="72" class="maintenance-logo" />
      <h1>Sistema em manutenção</h1>
      <p>O sistema de chamados estará temporariamente indisponível para manutenção programada.</p>
      <div class="maintenance-window">Manutenção: 17:00 às 20:00</div>
      <p>Por favor, tente novamente após esse horário. Pedimos desculpas pelo inconveniente.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.maintenance-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #eef4fb 0%, #dce8f8 100%);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
.maintenance-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(16, 24, 40, 0.12);
  padding: 40px 36px;
  max-width: 460px;
  width: 100%;
  text-align: center;
}
.maintenance-logo {
  margin-bottom: 16px;
}
.maintenance-card h1 {
  font-size: 1.35rem;
  margin: 0 0 8px;
  color: #1565c0;
}
.maintenance-card p {
  margin: 8px 0;
  line-height: 1.55;
  color: #4b5563;
}
.maintenance-window {
  margin-top: 18px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #f3f6fb;
  font-weight: 600;
  color: #1565c0;
}
</style>
