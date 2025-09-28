<template>
  <section class="rounded-2xl bg-white p-8 shadow-lg">
    <h2 class="text-xl font-semibold text-slate-800">Параметры задачи линейного программирования</h2>
    <p class="mt-1 text-sm text-slate-500">
      Метод внутренней точки решает минимизацию \(c^T x\) при ограничениях \(Ax = b,\ x &gt; 0\).
    </p>

    <form class="mt-6 grid gap-6" @submit.prevent="submit">
      <div class="grid gap-2">
        <label class="font-medium text-slate-600" for="matrix">Матрица ограничений A</label>
        <textarea
          id="matrix"
          v-model="matrixInput"
          class="min-h-[120px] rounded-lg border border-slate-200 p-3 font-mono text-sm focus:border-primary focus:outline-none"
          placeholder="1 1\n1 -1"
        ></textarea>
        <p class="text-xs text-slate-500">Каждая строка — отдельное равенство, элементы разделяются пробелами.</p>
      </div>

      <div class="grid gap-2 sm:grid-cols-2 sm:gap-6">
        <label class="grid gap-1 text-sm" for="vector-b">
          <span class="font-medium text-slate-600">Вектор b</span>
          <input
            id="vector-b"
            v-model="bInput"
            type="text"
            class="rounded-lg border border-slate-200 p-2 font-mono text-sm focus:border-primary focus:outline-none"
            placeholder="1 0"
          />
        </label>
        <label class="grid gap-1 text-sm" for="vector-c">
          <span class="font-medium text-slate-600">Вектор c</span>
          <input
            id="vector-c"
            v-model="cInput"
            type="text"
            class="rounded-lg border border-slate-200 p-2 font-mono text-sm focus:border-primary focus:outline-none"
            placeholder="1 1"
          />
        </label>
      </div>

      <div class="grid gap-2 sm:grid-cols-2 sm:gap-6">
        <label class="grid gap-1 text-sm" for="vector-x0">
          <span class="font-medium text-slate-600">Начальное x (опционально)</span>
          <input
            id="vector-x0"
            v-model="x0Input"
            type="text"
            class="rounded-lg border border-slate-200 p-2 font-mono text-sm focus:border-primary focus:outline-none"
            placeholder="0.5 0.5"
          />
        </label>
        <label class="grid gap-1 text-sm" for="vector-s0">
          <span class="font-medium text-slate-600">Начальное s (опционально)</span>
          <input
            id="vector-s0"
            v-model="s0Input"
            type="text"
            class="rounded-lg border border-slate-200 p-2 font-mono text-sm focus:border-primary focus:outline-none"
            placeholder="1 1"
          />
        </label>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1 text-sm" for="max-iter">
          <span class="font-medium text-slate-600">Максимум итераций</span>
          <input
            id="max-iter"
            v-model.number="maxIter"
            type="number"
            min="1"
            class="rounded-lg border border-slate-200 p-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label class="grid gap-1 text-sm" for="tolerance">
          <span class="font-medium text-slate-600">Порог остановки</span>
          <input
            id="tolerance"
            v-model.number="tolerance"
            type="number"
            min="1e-10"
            step="any"
            class="rounded-lg border border-slate-200 p-2 focus:border-primary focus:outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        :disabled="props.loading"
        class="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-primary/60"
      >
        {{ props.loading ? "Выполнение…" : "Запустить метод" }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useNotifications } from "@/composables/useNotifications";

export interface InteriorPointTaskPayload {
  type: "interior-point";
  matrix: number[];
  m: number;
  n: number;
  b: number[];
  c: number[];
  maxIter: number;
  tolerance: number;
  x0?: number[];
  s0?: number[];
}

const props = defineProps<{ loading: boolean }>();
const emit = defineEmits<{ (e: "task-submitted", payload: InteriorPointTaskPayload): void }>();

const notifications = useNotifications();

const matrixInput = ref("1 1\n1 -1");
const bInput = ref("1 0");
const cInput = ref("1 1");
const x0Input = ref("0.5 0.5");
const s0Input = ref("1 1");
const maxIter = ref(30);
const tolerance = ref(1e-6);

function parseVector(input: string): number[] {
  if (!input.trim()) return [];
  return input
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));
}

function buildPayload(): InteriorPointTaskPayload | null {
  const rows = matrixInput.value
    .trim()
    .split(/\n+/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
    .map((row) => row.split(/\s+/).map((value) => Number(value)));

  if (rows.length === 0) {
    return null;
  }

  const m = rows.length;
  const n = rows[0].length;
  const flat: number[] = [];

  for (const row of rows) {
    if (row.length !== n || row.some((value) => Number.isNaN(value))) {
      return null;
    }
    flat.push(...row);
  }

  const b = parseVector(bInput.value);
  const c = parseVector(cInput.value);
  const x0 = parseVector(x0Input.value);
  const s0 = parseVector(s0Input.value);

  if (b.length !== m || b.some((value) => Number.isNaN(value))) {
    return null;
  }
  if (c.length !== n || c.some((value) => Number.isNaN(value))) {
    return null;
  }

  return {
    type: "interior-point",
    matrix: flat,
    m,
    n,
    b,
    c,
    maxIter: Math.max(1, Math.floor(maxIter.value)),
    tolerance: Math.max(1e-10, Number(tolerance.value)),
    x0: x0.length === n && !x0.some((value) => Number.isNaN(value)) ? x0 : undefined,
    s0: s0.length === n && !s0.some((value) => Number.isNaN(value)) ? s0 : undefined,
  };
}

const submit = () => {
  const payload = buildPayload();
  if (!payload) {
    notifications.notifyError("Не удалось сформировать задачу. Проверьте введённые данные.");
    return;
  }
  emit("task-submitted", payload);
};
</script>

<style scoped>
form {
  max-width: 760px;
}
</style>
