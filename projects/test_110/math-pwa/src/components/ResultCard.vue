<template>
  <section class="rounded-2xl border border-dashed border-primary/40 bg-white/80 p-6 text-slate-700 shadow-inner">
    <h2 class="text-lg font-semibold text-primary-dark">Результат</h2>
    <p v-if="!result" class="mt-2 text-sm text-slate-500">
      После выполнения вычисления здесь появится сводка.
    </p>
    <pre v-else class="mt-4 overflow-x-auto rounded-lg bg-slate-900/90 p-4 font-mono text-sm text-lime-200">
{{ result }}
    </pre>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ result: string | null }>();
</script>
