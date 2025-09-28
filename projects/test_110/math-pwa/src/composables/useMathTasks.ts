export interface InteriorPointResult {
  success: boolean;
  iterations: number;
  objective: number;
  primalResidual: number;
  dualResidual: number;
  solution: number[];
  progress: number[];
}

export function buildSummary(result: InteriorPointResult): string {
  const status = result.success ? "Успех" : "Достигнут предел итераций";
  const solution = result.solution.map((value, idx) => `x${idx + 1} = ${value.toFixed(6)}`).join("\n");

  const header = [
    `Статус: ${status}`,
    `Итерации: ${result.iterations}`,
    `Целевая функция cᵀx: ${result.objective.toFixed(6)}`,
    `‖Ax − b‖₂: ${result.primalResidual.toExponential(3)}`,
    `‖Aᵀy + s − c‖₂: ${result.dualResidual.toExponential(3)}`,
  ].join("\n");

  const maxRows = 6;
  const rows: string[] = [];
  for (let i = 0; i < result.iterations && i < maxRows; i++) {
    const base = i * 4;
    const obj = result.progress[base]?.toFixed(6) ?? "";
    const mu = result.progress[base + 1]?.toExponential(3) ?? "";
    const rp = result.progress[base + 2]?.toExponential(3) ?? "";
    const rd = result.progress[base + 3]?.toExponential(3) ?? "";
    rows.push(`${i + 1}. f(x)=${obj}; μ=${mu}; ‖rₚ‖=${rp}; ‖r_d‖=${rd}`);
  }

  const history = rows.length > 0 ? `\nПрогресс:\n${rows.join("\n")}` : "";

  return `${header}\n${history}\n\nРешение:\n${solution}`;
}

export function extractObjectiveSeries(progress: number[]): number[] {
  const series: number[] = [];
  for (let i = 0; i < progress.length; i += 4) {
    series.push(progress[i] ?? 0);
  }
  return series;
}
