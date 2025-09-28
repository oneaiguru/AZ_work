<template>
  <transition-group name="toast" tag="aside" class="fixed bottom-6 right-6 flex flex-col gap-3">
    <article
      v-for="toast in toasts"
      :key="toast.id"
      class="w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-primary/20"
      :class="toast.type === 'error' ? 'border-red-300' : 'border-emerald-300'"
    >
      <h3 class="text-sm font-semibold" :class="toast.type === 'error' ? 'text-red-600' : 'text-emerald-600'">
        {{ toast.type === 'error' ? 'Ошибка' : 'Успех' }}
      </h3>
      <p class="mt-1 text-sm text-slate-600">{{ toast.message }}</p>
    </article>
  </transition-group>
</template>

<script setup lang="ts">
import { useNotifications } from "@/composables/useNotifications";

const { toasts } = useNotifications();
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
