<template>
  <section class="rounded-2xl bg-white p-6 shadow-md">
    <h2 class="text-lg font-semibold text-slate-700">Динамика целевой функции</h2>
    <p v-if="!hasData" class="mt-2 text-sm text-slate-500">
      После запуска метода график покажет значение \(c^T x\) на каждой итерации.
    </p>
    <svg
      v-else
      class="mt-4 h-48 w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="presentation"
    >
      <polyline
        :points="points"
        fill="none"
        stroke="#2563eb"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <line x1="0" y1="100" x2="100" y2="100" stroke="#94a3b8" stroke-width="0.5" />
    </svg>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ data: number[] }>();

const hasData = computed(() => props.data.length > 1);

const points = computed(() => {
  if (!hasData.value) return "";
  const max = Math.max(...props.data);
  const min = Math.min(...props.data);
  const range = max === min ? 1 : max - min;
  return props.data
    .map((value, index) => {
      const x = (index / (props.data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 90 - 5;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
});
</script>
