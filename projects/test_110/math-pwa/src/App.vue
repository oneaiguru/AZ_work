<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-light/20 via-white to-primary-light/10">
    <header class="py-10 text-center">
      <h1 class="text-3xl font-bold text-primary-dark">Interior Point Lab</h1>
      <p class="mt-2 text-slate-600">Эксперименты с методом внутренней точки в браузере.</p>
    </header>
    <main class="mx-auto flex max-w-5xl flex-col gap-8 px-6 pb-16">
      <MathForm @task-submitted="handleTask" :loading="loading" />
      <ResultCard :result="result" />
      <GraphCanvas :data="chartData" />
    </main>
    <NotificationToast />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import MathForm, { type InteriorPointTaskPayload } from "@/components/MathForm.vue";
import ResultCard from "@/components/ResultCard.vue";
import NotificationToast from "@/components/NotificationToast.vue";
import GraphCanvas from "@/components/GraphCanvas.vue";
import { useMathWasm } from "@/composables/useMathWasm";
import { useNotifications } from "@/composables/useNotifications";

const { notifyError, notifySuccess } = useNotifications();
const { loadModule, runTask } = useMathWasm();
const loading = ref(false);
const result = ref<string | null>(null);
const chartData = ref<number[]>([]);

loadModule().catch(() => {
  notifyError("Не удалось загрузить WASM-модуль");
});

const handleTask = async (payload: InteriorPointTaskPayload) => {
  loading.value = true;
  try {
    const { summary, series } = await runTask(payload);
    result.value = summary;
    chartData.value = series;
    notifySuccess("Расчёт завершён!");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notifyError(`Ошибка вычисления: ${message}`);
  } finally {
    loading.value = false;
  }
};
</script>
