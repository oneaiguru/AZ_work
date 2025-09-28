import loader, { ASUtil } from "@assemblyscript/loader";
import wasmUrl from "@/wasm/build/optimized.wasm?url";
import type { InteriorPointTaskPayload } from "@/components/MathForm.vue";
import { buildSummary, extractObjectiveSeries } from "@/composables/useMathTasks";

interface InteriorPointExports {
  memory: WebAssembly.Memory;
  FLOAT64ARRAY_ID: number;
  interiorPointSolve(
    matrixPtr: number,
    bPtr: number,
    cPtr: number,
    m: number,
    n: number,
    maxIter: number,
    tol: number,
    x0Ptr: number,
    s0Ptr: number
  ): number;
}

type InteriorPointModule = ASUtil & { exports: InteriorPointExports };

let modulePromise: Promise<InteriorPointModule> | null = null;

async function instantiate(): Promise<InteriorPointModule> {
  if (!modulePromise) {
    modulePromise = loader
      .instantiate<InteriorPointExports>(fetch(wasmUrl))
      .then((instance) => instance as InteriorPointModule);
  }
  return modulePromise;
}

export function useMathWasm() {
  async function loadModule() {
    await instantiate();
  }

  async function runTask(payload: InteriorPointTaskPayload) {
    const wasm = await instantiate();
    const { matrix, m, n, b, c, maxIter, tolerance, x0, s0 } = payload;

    const matrixPtr = wasm.__newArray(wasm.exports.FLOAT64ARRAY_ID, matrix);
    const bPtr = wasm.__newArray(wasm.exports.FLOAT64ARRAY_ID, b);
    const cPtr = wasm.__newArray(wasm.exports.FLOAT64ARRAY_ID, c);
    const x0Ptr = wasm.__newArray(wasm.exports.FLOAT64ARRAY_ID, x0 ?? []);
    const s0Ptr = wasm.__newArray(wasm.exports.FLOAT64ARRAY_ID, s0 ?? []);

    const resultPtr = wasm.exports.interiorPointSolve(
      matrixPtr,
      bPtr,
      cPtr,
      m,
      n,
      maxIter,
      tolerance,
      x0Ptr,
      s0Ptr
    );

    const raw = wasm.__getArray(resultPtr) as number[];
    const headerSize = 5;
    const iterations = Math.max(0, Math.min(Math.floor(raw[1] ?? 0), 512));
    const progressLength = iterations * 4;
    const progress = raw.slice(headerSize, headerSize + progressLength);
    const solution = raw.slice(headerSize + progressLength);

    const summary = buildSummary({
      success: raw[0] === 1,
      iterations,
      objective: raw[2] ?? Number.NaN,
      primalResidual: raw[3] ?? Number.NaN,
      dualResidual: raw[4] ?? Number.NaN,
      solution,
      progress,
    });

    const chartSeries = extractObjectiveSeries(progress);

    return { summary, series: chartSeries };
  }

  return { loadModule, runTask };
}
