export const FLOAT64ARRAY_ID: i32 = idof<Float64Array>();

const MIN_VALUE: f64 = 1e-12;

function matIndex(row: i32, col: i32, cols: i32): i32 {
  return row * cols + col;
}

function matVec(a: Float64Array, rows: i32, cols: i32, x: Float64Array, out: Float64Array): void {
  for (let i = 0; i < rows; i++) {
    let sum = 0.0;
    for (let j = 0; j < cols; j++) {
      sum += a[matIndex(i, j, cols)] * x[j];
    }
    out[i] = sum;
  }
}

function matVecTranspose(a: Float64Array, rows: i32, cols: i32, y: Float64Array, out: Float64Array): void {
  for (let j = 0; j < cols; j++) {
    let sum = 0.0;
    for (let i = 0; i < rows; i++) {
      sum += a[matIndex(i, j, cols)] * y[i];
    }
    out[j] = sum;
  }
}

function dot(x: Float64Array, y: Float64Array, length: i32): f64 {
  let sum = 0.0;
  for (let i = 0; i < length; i++) {
    sum += x[i] * y[i];
  }
  return sum;
}

function norm2(vec: Float64Array, length: i32): f64 {
  let sum = 0.0;
  for (let i = 0; i < length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

function solveLinearSystem(matrix: Float64Array, rhs: Float64Array, size: i32): void {
  for (let k = 0; k < size; k++) {
    let pivot = matrix[matIndex(k, k, size)];
    if (Math.abs(pivot) < MIN_VALUE) {
      pivot = pivot >= 0 ? MIN_VALUE : -MIN_VALUE;
      matrix[matIndex(k, k, size)] = pivot;
    }
    for (let i = k + 1; i < size; i++) {
      const factor = matrix[matIndex(i, k, size)] / pivot;
      matrix[matIndex(i, k, size)] = 0.0;
      for (let j = k + 1; j < size; j++) {
        matrix[matIndex(i, j, size)] -= factor * matrix[matIndex(k, j, size)];
      }
      rhs[i] -= factor * rhs[k];
    }
  }

  for (let i = size - 1; i >= 0; i--) {
    let sum = rhs[i];
    for (let j = i + 1; j < size; j++) {
      sum -= matrix[matIndex(i, j, size)] * rhs[j];
    }
    const diag = matrix[matIndex(i, i, size)];
    rhs[i] = sum / (Math.abs(diag) < MIN_VALUE ? MIN_VALUE : diag);
  }
}

export function interiorPointSolve(
  a: Float64Array,
  b: Float64Array,
  c: Float64Array,
  m: i32,
  n: i32,
  maxIter: i32,
  tol: f64,
  x0: Float64Array,
  s0: Float64Array
): Float64Array {
  const rows = m;
  const cols = n;
  const iterations = max<i32>(1, maxIter);
  const tolerance = tol > 0.0 ? tol : 1e-6;

  const x = new Float64Array(cols);
  const s = new Float64Array(cols);
  const y = new Float64Array(rows);

  for (let i = 0; i < cols; i++) {
    const initialX = i < x0.length ? x0[i] : 1.0;
    const initialS = i < s0.length ? s0[i] : 1.0;
    x[i] = initialX > MIN_VALUE ? initialX : MIN_VALUE;
    s[i] = initialS > MIN_VALUE ? initialS : MIN_VALUE;
  }

  const rPrimal = new Float64Array(rows);
  const rDual = new Float64Array(cols);
  const rCent = new Float64Array(cols);
  const sInvRCent = new Float64Array(cols);
  const diagXDivS = new Float64Array(cols);
  const tempVecN = new Float64Array(cols);
  const tempVecM = new Float64Array(rows);
  const rhs = new Float64Array(rows);
  const systemMatrix = new Float64Array(rows * rows);
  const dy = new Float64Array(rows);
  const dx = new Float64Array(cols);
  const ds = new Float64Array(cols);
  const progress = new Float64Array(iterations * 4);

  let iterCount = 0;
  let success = false;

  for (let iter = 0; iter < iterations; iter++) {
    matVec(a, rows, cols, x, rPrimal);
    for (let i = 0; i < rows; i++) {
      rPrimal[i] -= b[i];
    }

    matVecTranspose(a, rows, cols, y, rDual);
    for (let j = 0; j < cols; j++) {
      rDual[j] += s[j] - c[j];
    }

    const mu = dot(x, s, cols) / <f64>cols;
    const primalNorm = norm2(rPrimal, rows);
    const dualNorm = norm2(rDual, cols);
    const objective = dot(c, x, cols);

    progress[iter * 4] = objective;
    progress[iter * 4 + 1] = mu;
    progress[iter * 4 + 2] = primalNorm;
    progress[iter * 4 + 3] = dualNorm;

    iterCount = iter + 1;

    if (primalNorm <= tolerance && dualNorm <= tolerance && mu <= tolerance) {
      success = true;
      break;
    }

    const sigma: f64 = 0.25;
    for (let j = 0; j < cols; j++) {
      const xs = x[j] * s[j];
      rCent[j] = xs - sigma * mu;
      const safeS = s[j] > MIN_VALUE ? s[j] : MIN_VALUE;
      sInvRCent[j] = rCent[j] / safeS;
      diagXDivS[j] = x[j] / safeS;
      tempVecN[j] = diagXDivS[j] * rDual[j];
    }

    matVec(a, rows, cols, sInvRCent, tempVecM);
    matVec(a, rows, cols, tempVecN, rhs);

    for (let i = 0; i < rows; i++) {
      rhs[i] = -rPrimal[i] + tempVecM[i] - rhs[i];
    }

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < rows; j++) {
        let sum = 0.0;
        for (let k = 0; k < cols; k++) {
          sum += a[matIndex(i, k, cols)] * diagXDivS[k] * a[matIndex(j, k, cols)];
        }
        systemMatrix[matIndex(i, j, rows)] = sum;
      }
    }

    solveLinearSystem(systemMatrix, rhs, rows);

    for (let i = 0; i < rows; i++) {
      dy[i] = rhs[i];
    }

    matVecTranspose(a, rows, cols, dy, ds);
    for (let j = 0; j < cols; j++) {
      ds[j] = -rDual[j] - ds[j];
    }

    for (let j = 0; j < cols; j++) {
      const safeS = s[j] > MIN_VALUE ? s[j] : MIN_VALUE;
      const term = -rCent[j] - x[j] * ds[j];
      dx[j] = term / safeS;
    }

    let alphaPrimal = 1.0;
    let alphaDual = 1.0;
    for (let j = 0; j < cols; j++) {
      if (dx[j] < 0.0) {
        const step = -0.99 * x[j] / dx[j];
        if (step < alphaPrimal) alphaPrimal = step;
      }
      if (ds[j] < 0.0) {
        const step = -0.99 * s[j] / ds[j];
        if (step < alphaDual) alphaDual = step;
      }
    }

    let alpha = alphaPrimal < alphaDual ? alphaPrimal : alphaDual;
    if (alpha > 1.0) alpha = 1.0;
    if (!isFinite<f64>(alpha) || alpha <= 0.0) {
      alpha = 0.5;
    }

    for (let j = 0; j < cols; j++) {
      x[j] += alpha * dx[j];
      s[j] += alpha * ds[j];
      if (x[j] < MIN_VALUE) x[j] = MIN_VALUE;
      if (s[j] < MIN_VALUE) s[j] = MIN_VALUE;
    }

    for (let i = 0; i < rows; i++) {
      y[i] += alpha * dy[i];
    }
  }

  matVec(a, rows, cols, x, rPrimal);
  for (let i = 0; i < rows; i++) {
    rPrimal[i] -= b[i];
  }
  matVecTranspose(a, rows, cols, y, rDual);
  for (let j = 0; j < cols; j++) {
    rDual[j] += s[j] - c[j];
  }

  const finalObjective = dot(c, x, cols);
  const finalPrimal = norm2(rPrimal, rows);
  const finalDual = norm2(rDual, cols);

  const headerSize = 5;
  const resultLength = headerSize + iterCount * 4 + cols;
  const result = new Float64Array(resultLength);

  result[0] = success ? 1.0 : 0.0;
  result[1] = <f64>iterCount;
  result[2] = finalObjective;
  result[3] = finalPrimal;
  result[4] = finalDual;

  for (let i = 0; i < iterCount; i++) {
    const base = headerSize + i * 4;
    const src = i * 4;
    result[base] = progress[src];
    result[base + 1] = progress[src + 1];
    result[base + 2] = progress[src + 2];
    result[base + 3] = progress[src + 3];
  }

  const solutionOffset = headerSize + iterCount * 4;
  for (let j = 0; j < cols; j++) {
    result[solutionOffset + j] = x[j];
  }

  return result;
}
