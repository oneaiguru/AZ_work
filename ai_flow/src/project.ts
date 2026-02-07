import fs from "node:fs";
import path from "node:path";
import {
  gitBranchExists,
  gitCheckoutBranch,
  gitCommit,
  gitCreateBranch,
  gitCurrentBranch,
  gitIsClean,
  gitStageAll,
  runGit,
} from "./git";

const BRANCH_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const BRANCH_STATUSES = ["experiment", "success", "closed"] as const;
const PROJECT_TEMPLATE = `# Проект: {project_title}

## Базовая информация

- Дата начала: {date}
- Каталог: {project_dir}
- Статус: draft

## Цель проекта

<опишите цель проекта здесь>

## Контекст

- ...

## Ограничения и допущения

- ...

## Критерии успеха

- [ ] Определить критерий 1
- [ ] Определить критеррий 2

## Структура

- План: plan.md
- Журнал шагов: journal.md
- Ветки рассуждений: branches/
`;
const PLAN_TEMPLATE = `# План проекта

## Текущее состояние

- Активная ветка: A_main (по умолчанию, при наличии)
- Статус: draft

## Этапы

1. Этап 1 — <описание>
   - [ ] Задача 1.1
   - [ ] Задача 1.2

2. Этап 2 — <описание>
   - [ ] Задача 2.1
   - [ ] Задача 2.2

## Сделано (кратко)

- (заполняйте по мере выполнения шагов)
`;
const JOURNAL_TEMPLATE = `# Журнал шагов

> Каждый прогон ИИ = одна запись.
> Записывайте: дату, ветку, шаг, статус и краткий результат.

---

`;
const BRANCH_INFO_TEMPLATE = `# Ветка: {branch_id}

## Общая информация

- Идентификатор: {branch_id}
- Название: {branch_title}
- Статус: {status}
- Причина закрытия: {closed_reason}

## Родительская ветка

- Родитель: {parent}
- Точка ответвления (шаг): {from_step}

## Цель ветки

<опишите цель ветки здесь>

## Стратегия

- <особенности промптов / подхода в этой ветке>

## История шагов (кратко)

- {branch_id}_001 — ...
`;
const PROMPT_TEMPLATE = `# Промпт шага {step_id}

- Проект: {project_title}
- Ветка: {branch_id}
- Шаг: {step_id}
- Дата/время: {datetime}
- Родительский шаг: {parent_step}

## Цель шага

Кратко, что хотим получить от ИИ в этом прогоне.

## Использованный контекст

Перечислите файлы/источники контекста:
- project.md
- plan.md
- journal.md
{parent_result_path_line}
- ...

## Текст промпта (как отправлен ИИ)

\`\`\`text
<сюда вставьте текст промпта один в один>
\`\`\`
`;
const CONTEXT_TEMPLATE = `# Контекст шага

Сюда можно складывать выдержки/заметки, которые вы копируете в промпт
или которые относятся именно к этому шагу.
`;
const RESULT_RAW_TEMPLATE = `# Сырой результат ИИ

Вставьте сюда ответ модели БЕЗ изменений.
`;
const EVALUATION_TEMPLATE = `# Оценка шага {step_id}

- Ветка: {branch_id}
- Шаг: {step_id}
- Дата/время оценки: {datetime}
- Ответ ИИ: result_raw.md
- Статус: success | partial | fail

## Что получилось хорошо

- ...

## Какие проблемы

- ...

## Вывод по шагу

- ...

## Дальнейшие действия

- [ ] Следующий шаг в этой ветке
- [ ] Создать новую ветку с другой стратегией промптов
`;
const TIME_LOG_HEADER = `# Отчёт времени

`;
export const TIME_LOG_FILE = "time_log.md";
export const SUPPORTED_ACTIVITIES = ["coding", "reading", "AI"] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

type BranchMeta = {
  id: string;
  title: string;
  parent: string;
  from_step: string;
  status: string;
  closed_reason: string;
  steps: Array<{ id: string; status: string }>;
};

function ensureDir(target: string) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
    console.log(`[OK]   Created directory: ${target}`);
  } else if (!fs.statSync(target).isDirectory()) {
    throw new Error(`Path exists but is not a directory: ${target}`);
  }
}

function writeFileIfMissing(target: string, content: string) {
  const dir = path.dirname(target);
  if (dir) {
    ensureDir(dir);
  }
  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, content, { encoding: "utf-8" });
  }
}

function fillTemplate(template: string, data: Record<string, string>) {
  let out = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{${key}\\}`, "g");
    out = out.replace(regex, value);
  }
  return out;
}

function ensureProject(projectPath: string) {
  const resolved = path.resolve(projectPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Project directory not found: ${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`Project path is not a directory: ${resolved}`);
  }
  return resolved;
}

export interface InitOptions {
  title?: string;
  date?: string;
}

export function initProject(projectPath: string, options: InitOptions = {}) {
  const resolved = path.resolve(projectPath);
  ensureDir(resolved);
  const title = options.title?.trim() || path.basename(resolved);
  const date = options.date?.trim() || new Date().toISOString().split("T")[0];
  writeFileIfMissing(
    path.join(resolved, "project.md"),
    fillTemplate(PROJECT_TEMPLATE, {
      project_title: title,
      date,
      project_dir: resolved,
    })
  );
  writeFileIfMissing(path.join(resolved, "plan.md"), PLAN_TEMPLATE);
  writeFileIfMissing(path.join(resolved, "journal.md"), JOURNAL_TEMPLATE);
  ensureBranches(resolved);
  ensureTimeLog(resolved);
  const branchesRoot = path.join(resolved, "branches");
  if (!fs.existsSync(branchesRoot) || !fs.readdirSync(branchesRoot).length) {
    createBranch(resolved, undefined, {
      title: "Основная ветка",
      status: "experiment",
      skipGitCheck: true,
    });
  }
  return resolved;
}

export function ensureBranches(base: string) {
  ensureDir(path.join(base, "branches"));
}

export type TimeAction = "start" | "stop";

export interface TimeEventOptions {
  activity?: string;
  note?: string;
  timestamp?: string;
}

export function ensureTimeLog(base: string) {
  const target = path.join(base, TIME_LOG_FILE);
  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, TIME_LOG_HEADER, { encoding: "utf-8" });
  }
}

export function recordTimeEvent(projectPath: string, action: TimeAction, options: TimeEventOptions = {}) {
  const resolved = ensureProject(projectPath);
  ensureTimeLog(resolved);
  const timestamp = options.timestamp || new Date().toISOString();
  const entry = [timestamp, action, options.activity || "", options.note || ""].join("\t");
  fs.appendFileSync(path.join(resolved, TIME_LOG_FILE), `${entry}\n`, { encoding: "utf-8" });
  return entry;
}

function parseRange(range: string) {
  const [fromRaw, toRaw] = range.split(",", 2).map((value) => value.trim());
  const from = fromRaw ? new Date(`${fromRaw}T00:00:00Z`) : undefined;
  const to = toRaw ? new Date(`${toRaw}T23:59:59Z`) : undefined;
  if (from && Number.isNaN(from.getTime())) {
    throw new Error("Invalid range start date");
  }
  if (to && Number.isNaN(to.getTime())) {
    throw new Error("Invalid range end date");
  }
  return { from, to };
}

export interface TimeReportOptions {
  date?: string;
  range?: string;
}

function matchesRange(timestamp: string, range?: { from?: Date; to?: Date }) {
  if (!range || (!range.from && !range.to)) {
    return true;
  }
  const current = new Date(timestamp);
  if (Number.isNaN(current.getTime())) {
    return false;
  }
  if (range.from && current < range.from) {
    return false;
  }
  if (range.to && current > range.to) {
    return false;
  }
  return true;
}

export function timeReport(projectPath: string, options: TimeReportOptions = {}) {
  const resolved = ensureProject(projectPath);
  const logPath = path.join(resolved, TIME_LOG_FILE);
  if (!fs.existsSync(logPath)) {
    return "No time entries recorded yet.";
  }
  const raw = fs.readFileSync(logPath, "utf-8");
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}/;
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && isoDatePattern.test(line) && line.includes("\t"));
  const parsed = lines
    .map((line) => {
      const [timestamp, action, activity = "", note = ""] = line.split("\t");
      if (!timestamp || !action) {
        return null;
      }
      return { timestamp, action, activity, note };
    })
    .filter(Boolean) as Array<{ timestamp: string; action: string; activity: string; note: string }>;
  let range: { from?: Date; to?: Date } | undefined;
  if (options.range) {
    range = parseRange(options.range);
  }
  const filtered = parsed.filter((entry) => {
    if (options.date && !entry.timestamp.startsWith(options.date)) {
      return false;
    }
    return matchesRange(entry.timestamp, range);
  });
  if (!filtered.length) {
    return "No events for the requested period.";
  }
  const summary = filtered
    .map(
      (entry) => `${entry.timestamp} | ${entry.action.toUpperCase()} | ${entry.activity || "-"} | ${entry.note || "-"}`
    )
    .join("\\n");
  return `${summary}\\nTotal events: ${filtered.length}`;
}

export function listProjects(baseDir: string) {
  const results: Array<{ name: string; path: string }> = [];
  if (!fs.existsSync(baseDir)) {
    return results;
  }
  for (const entry of fs.readdirSync(baseDir)) {
    const candidate = path.join(baseDir, entry);
    if (!fs.statSync(candidate).isDirectory()) {
      continue;
    }
    if (!fs.existsSync(path.join(candidate, "project.md"))) {
      continue;
    }
    results.push({ name: entry, path: candidate });
  }
  return results;
}

function numberToLetters(index: number) {
  let result = "";
  let i = index;
  while (true) {
    const rem = i % BRANCH_ALPHABET.length;
    result = BRANCH_ALPHABET[rem] + result;
    i = Math.floor(i / BRANCH_ALPHABET.length);
    if (i === 0) {
      break;
    }
    i -= 1;
  }
  return result;
}

export function generateBranchId(projectPath: string) {
  const branchesRoot = path.join(projectPath, "branches");
  if (!fs.existsSync(branchesRoot)) {
    return "A";
  }
  const existing = new Set(
    fs.readdirSync(branchesRoot)
      .map((name) => name.toUpperCase())
      .filter(Boolean)
  );
  for (const letter of BRANCH_ALPHABET) {
    if (!existing.has(letter)) {
      return letter;
    }
  }
  let counter = 0;
  while (true) {
    const candidate =
      counter < BRANCH_ALPHABET.length
        ? `Z${numberToLetters(counter)}`
        : `ZZ${numberToLetters(counter - BRANCH_ALPHABET.length)}`;
    if (!existing.has(candidate.toUpperCase())) {
      return candidate;
    }
    counter += 1;
  }
}

function parseStepDirName(name: string, branchId: string) {
  const prefix = new RegExp(`^${branchId}_(\\d+)$`);
  const digits = /^(\d+)$/;
  const prefixMatch = prefix.exec(name);
  if (prefixMatch) {
    return Number(prefixMatch[1]);
  }
  const digitsMatch = digits.exec(name);
  if (digitsMatch) {
    return Number(digitsMatch[1]);
  }
  return null;
}

function listStepInfo(branchDir: string, branchId: string) {
  const runsDir = path.join(branchDir, "runs");
  if (!fs.existsSync(runsDir)) {
    return [] as Array<[number, string]>;
  }
  const info: Array<[number, string]> = [];
  for (const name of fs.readdirSync(runsDir)) {
    const candidate = path.join(runsDir, name);
    if (!fs.statSync(candidate).isDirectory()) {
      continue;
    }
    const num = parseStepDirName(name, branchId);
    if (num !== null) {
      info.push([num, name]);
    }
  }
  info.sort((a, b) => a[0] - b[0]);
  return info;
}

function getLastStepId(branchDir: string, branchId: string) {
  const info = listStepInfo(branchDir, branchId);
  if (!info.length) {
    return null;
  }
  return info[info.length - 1][1];
}

function generateStepId(branchDir: string) {
  const branchId = path.basename(path.normalize(branchDir));
  const info = listStepInfo(branchDir, branchId);
  const maxNum = info.length ? info[info.length - 1][0] : 0;
  return `${branchId}_${String(maxNum + 1).padStart(3, "0")}`;
}

function sanitizeId(value: string) {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

function cleanLabel(text: string) {
  return text.replace(/"/g, "'");
}

function readBranchMetadata(branchDir: string): BranchMeta {
  const branchId = path.basename(branchDir);
  const meta: BranchMeta = {
    id: branchId,
    title: branchId,
    parent: "none",
    from_step: "n/a",
    status: "experiment",
    closed_reason: "n/a",
    steps: [],
  };
  const infoPath = path.join(branchDir, "branch-info.md");
  if (!fs.existsSync(infoPath)) {
    return meta;
  }
  const raw = fs.readFileSync(infoPath, "utf-8");
  for (const line of raw.split("\\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- Название:")) {
      meta.title = trimmed.split(":", 1)[1].trim() || meta.title;
    } else if (trimmed.startsWith("- Родитель:")) {
      meta.parent = trimmed.split(":", 1)[1].trim() || "none";
    } else if (trimmed.startsWith("- Точка")) {
      meta.from_step = trimmed.split(":", 1)[1].trim() || "n/a";
    } else if (trimmed.startsWith("- Статус:")) {
      const statusFragment = trimmed.split(":", 1)[1].split("#", 1)[0].trim().toLowerCase();
      meta.status = statusFragment || meta.status;
    } else if (trimmed.startsWith("- Причина закрытия:")) {
      meta.closed_reason = trimmed.split(":", 1)[1].trim() || "n/a";
    }
  }
  return meta;
}

function readStepStatus(stepDir: string) {
  const evaluationPath = path.join(stepDir, "evaluation.md");
  if (!fs.existsSync(evaluationPath)) {
    return "unknown";
  }
  try {
    const raw = fs.readFileSync(evaluationPath, "utf-8");
    for (const line of raw.split("\\n")) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith("- статус:")) {
        const parts = trimmed.split(":", 1)[1].trim();
        if (parts.includes("|")) {
          return "unknown";
        }
        return parts.split(" ")[0];
      }
    }
  } catch (error) {
    console.error(`[ERR] Failed to read ${evaluationPath}: ${error instanceof Error ? error.message : ""}`);
  }
  return "unknown";
}

export function collectProjectStructure(projectPath: string): BranchMeta[] {
  const branchesRoot = path.join(projectPath, "branches");
  const result: BranchMeta[] = [];
  if (!fs.existsSync(branchesRoot)) {
    return result;
  }
  for (const entry of fs.readdirSync(branchesRoot).sort()) {
    const branchDir = path.join(branchesRoot, entry);
    if (!fs.statSync(branchDir).isDirectory()) {
      continue;
    }
    const meta = readBranchMetadata(branchDir);
    const runsDir = path.join(branchDir, "runs");
    const steps = [];
    if (fs.existsSync(runsDir)) {
      for (const stepEntry of fs.readdirSync(runsDir).sort()) {
        const stepDir = path.join(runsDir, stepEntry);
        if (!fs.statSync(stepDir).isDirectory()) {
          continue;
        }
        steps.push({ id: stepEntry, status: readStepStatus(stepDir) });
      }
    }
    meta.steps = steps;
    result.push(meta);
  }
  return result;
}

export function buildMermaidDiagram(branches: BranchMeta[]): string {
  const lines = [
    "graph TD",
    "  %% autogenerated map of branches and steps",
  ];
  const branchNodes: Record<string, string> = {};
  const placeholderParents = new Set<string>();

  for (const branch of branches) {
    const slug = sanitizeId(branch.id);
    const nodeId = `branch_${slug}`;
    branchNodes[branch.id] = nodeId;
    const statusClass = BRANCH_STATUSES.includes(branch.status as BranchStatus)
      ? branch.status
      : "unknown";
    let label = `${branch.id} (${branch.status})`;
    if (
      branch.status === "closed" &&
      branch.closed_reason &&
      branch.closed_reason.toLowerCase() !== "n/a"
    ) {
      label += ` — ${branch.closed_reason}`;
    }
    lines.push(`  ${nodeId}["${cleanLabel(label)}"]:::branch_${statusClass}`);
  }

  lines.push("  %% branch links");
  for (const branch of branches) {
    const parent = branch.parent.trim();
    if (!parent || parent.toLowerCase() === "none" || parent.toLowerCase() === "n/a") {
      continue;
    }
    if (!branchNodes[parent] && !placeholderParents.has(parent)) {
      const placeholderId = `branch_${sanitizeId(parent)}`;
      lines.push(`  ${placeholderId}["${cleanLabel(parent)}"]:::branch_unknown`);
      branchNodes[parent] = placeholderId;
      placeholderParents.add(parent);
    }
    const parentNode = branchNodes[parent];
    const childNode = branchNodes[branch.id];
    const edgeLabel = branch.from_step && !["none", "n/a"].includes(branch.from_step.toLowerCase())
      ? branch.from_step
      : "";
    if (edgeLabel) {
      lines.push(`  ${parentNode} -->|${cleanLabel(edgeLabel)}| ${childNode}`);
    } else {
      lines.push(`  ${parentNode} --> ${childNode}`);
    }
  }

  lines.push("  %% steps within branches");
  for (const branch of branches) {
    const branchNode = branchNodes[branch.id];
    let prevStep: string | null = null;
    const branchSlug = sanitizeId(branch.id);
    for (const step of branch.steps) {
      const stepSlug = sanitizeId(step.id);
      const stepNode = `step_${branchSlug}_${stepSlug}`;
      const stepStatus = ["success", "partial", "fail"].includes(step.status) ? step.status : "unknown";
      lines.push(`  ${stepNode}["${cleanLabel(`${branch.id}/${step.id} (${step.status})`)}"]:::step_${stepStatus}`);
      if (prevStep) {
        lines.push(`  ${prevStep} --> ${stepNode}`);
      } else {
        lines.push(`  ${branchNode} --> ${stepNode}`);
      }
      prevStep = stepNode;
    }
  }

  lines.push("  %% styles");
  lines.push(
    "  classDef branch_experiment fill:#fff3cd,stroke:#d39e00,color:#8a6d3b;",
    "  classDef branch_success fill:#d4edda,stroke:#2e7d32,color:#1b5e20;",
    "  classDef branch_closed fill:#e2e3e5,stroke:#6c757d,color:#343a40;",
    "  classDef branch_unknown fill:#f8d7da,stroke:#c82333,color:#721c24;",
    "  classDef step_success fill:#d4edda,stroke:#2e7d32,color:#1b5e20;",
    "  classDef step_partial fill:#fff3cd,stroke:#d39e00,color:#8a6d3b;",
    "  classDef step_fail fill:#f8d7da,stroke:#c82333,color:#721c24;",
    "  classDef step_unknown fill:#e2e3e5,stroke:#6c757d,color:#343a40;"
  );

  return lines.join("\\n");
}

export interface BranchOptions {
  title?: string;
  parent?: string;
  fromStep?: string;
  status?: BranchStatus;
  closedReason?: string;
  skipGitCheck?: boolean;
}

export function createBranch(projectPath: string, branchId?: string, options: BranchOptions = {}) {
  const resolved = ensureProject(projectPath);
  ensureBranches(resolved);
  const branchesRoot = path.join(resolved, "branches");
  const finalBranchId = (branchId || generateBranchId(resolved)).trim();
  const branchDir = path.join(branchesRoot, finalBranchId);
  if (fs.existsSync(branchDir)) {
    throw new Error(`Branch ${finalBranchId} already exists in ${resolved}`);
  }
  if (!options.skipGitCheck) {
    const clean = gitIsClean(resolved);
    if (clean === false) {
      throw new Error("Repository has uncommitted changes.");
    }
  }
  ensureDir(branchDir);
  ensureDir(path.join(branchDir, "runs"));
  const branchTitle = options.title || finalBranchId;
  const parent = options.parent || "none";
  const requestedFrom = (options.fromStep || "").trim();
  const status = options.status || "experiment";
  if (!BRANCH_STATUSES.includes(status)) {
    throw new Error("Invalid branch status.");
  }
  const closedReason = status === "closed" ? options.closedReason || "<причина не указана>" : options.closedReason || "n/a";
  writeFileIfMissing(
    path.join(branchDir, "branch-info.md"),
    fillTemplate(BRANCH_INFO_TEMPLATE, {
      branch_id: finalBranchId,
      branch_title: branchTitle,
      parent,
      from_step: requestedFrom || "n/a",
      status,
      closed_reason: closedReason,
    })
  );
  const parentBranch = parent && parent.toLowerCase() !== "none" && parent.toLowerCase() !== "n/a" ? parent : gitCurrentBranch(resolved);
  gitCreateBranch(resolved, finalBranchId, parentBranch || undefined);
  newStep(resolved, {
    branchId: finalBranchId,
    stepId: undefined,
    fromStep: options.fromStep,
    skipGitCheck: true,
  });
  return finalBranchId;
}

interface NewStepOptions {
  branchId?: string;
  stepId?: string;
  fromStep?: string;
  skipGitCheck?: boolean;
}

function inferBranchIdFromGitBranch(branchName: string) {
  if (!branchName) {
    return "";
  }
  let value = branchName;
  if (value.includes("/")) {
    value = value.split("/", 1)[0];
  }
  const lastUnderscore = value.lastIndexOf("_");
  if (lastUnderscore > 0) {
    const suffix = value.slice(lastUnderscore + 1);
    if (/^\\d+$/.test(suffix)) {
      return value.slice(0, lastUnderscore);
    }
  }
  return value;
}

function normalizeStepId(branchId: string, stepReference: string) {
  const raw = stepReference.trim();
  if (raw.startsWith(`${branchId}_`)) {
    return raw;
  }
  if (/^\\d+$/.test(raw)) {
    return `${branchId}_${raw.padStart(3, "0")}`;
  }
  return raw;
}

export function newStep(projectPath: string, opts: NewStepOptions = {}) {
  const resolved = ensureProject(projectPath);
  const branchId = opts.branchId?.trim() || inferBranchIdFromGitBranch(gitCurrentBranch(resolved) || "");
  if (!branchId) {
    throw new Error("Branch id could not be inferred.");
  }
  const branchDir = path.join(resolved, "branches", branchId);
  if (!fs.existsSync(branchDir)) {
    throw new Error(`Branch ${branchId} not found in project ${resolved}`);
  }
  if (!opts.skipGitCheck) {
    const clean = gitIsClean(resolved);
    if (clean === false) {
      throw new Error("Repository has uncommitted changes.");
    }
  }
  let stepId = opts.stepId ? normalizeStepId(branchId, opts.stepId) : null;
  const previous = getLastStepId(branchDir, branchId);
  const baseForStepBranch = previous || branchId;
  if (!stepId) {
    stepId = generateStepId(branchDir);
    console.log(`[OK]   Generated step_id: ${stepId}`);
  }
  const stepBranch = stepId;
  gitCheckoutBranch(resolved, stepBranch, baseForStepBranch);
  const stepDir = path.join(branchDir, "runs", stepId);
  if (fs.existsSync(stepDir)) {
    throw new Error(`Step ${stepId} already exists in branch ${branchId}`);
  }
  ensureDir(stepDir);
  const dt = new Date();
  const dtStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(
    dt.getHours()
  ).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  const projectTitle = path.basename(resolved);
  const parentStep = opts.fromStep ? `${branchId}/${opts.fromStep}` : "<нет, шаг начинается с нуля>";
  const parentResultLine = opts.fromStep
    ? `- branches/${branchId}/runs/${opts.fromStep}/result_raw.md`
    : "# - (при необходимости добавьте путь к result_raw.md родительского шага)";
  writeFileIfMissing(
    path.join(stepDir, "prompt.md"),
    fillTemplate(PROMPT_TEMPLATE, {
      project_title: projectTitle,
      branch_id: branchId,
      step_id: stepId,
      datetime: dtStr,
      parent_step: parentStep,
      parent_result_path_line: parentResultLine,
    })
  );
  writeFileIfMissing(path.join(stepDir, "context.md"), CONTEXT_TEMPLATE);
  writeFileIfMissing(path.join(stepDir, "result_raw.md"), RESULT_RAW_TEMPLATE);
  writeFileIfMissing(
    path.join(stepDir, "evaluation.md"),
    fillTemplate(EVALUATION_TEMPLATE, {
      branch_id: branchId,
      step_id: stepId,
      datetime: dtStr,
    })
  );
  gitStageAll(resolved);
  const commit = gitCommit(resolved, `Add step ${stepBranch}`);
  if (!commit || commit.status !== 0) {
    console.warn("[WARN] Failed to commit new step.");
  }
  const force = runGit(resolved, ["branch", "-f", branchId, stepBranch]);
  if (!force || force.status !== 0) {
    console.warn(`[WARN] Unable to fast-forward branch ${branchId}`);
  }
  return stepBranch;
}

interface SwitchOptions {
  branchId?: string;
  stepId?: string;
  skipGitCheck?: boolean;
}

export function switchBranch(projectPath: string, options: SwitchOptions = {}) {
  const resolved = ensureProject(projectPath);
  if (!options.skipGitCheck) {
    const clean = gitIsClean(resolved);
    if (clean === false) {
      throw new Error("Repository has uncommitted changes.");
    }
  }
  const rawBranchRef = options.branchId || gitCurrentBranch(resolved);
  if (!rawBranchRef) {
    throw new Error("Unable to determine branch.");
  }
  const branchId = inferBranchIdFromGitBranch(rawBranchRef);
  let target = branchId;
  if (options.stepId) {
    const stepId = normalizeStepId(branchId, options.stepId);
    if (!gitBranchExists(resolved, stepId)) {
      throw new Error(`Git branch ${stepId} not found.`);
    }
    target = stepId;
  } else if (rawBranchRef !== branchId && gitBranchExists(resolved, rawBranchRef)) {
    target = rawBranchRef;
  }
  if (!gitBranchExists(resolved, target)) {
    throw new Error(`Git branch ${target} not found.`);
  }
  gitCheckoutBranch(resolved, target);
  return target;
}

export function diagram(projectPath: string, output?: string) {
  const resolved = ensureProject(projectPath);
  const branches = collectProjectStructure(resolved);
  const diagramText = buildMermaidDiagram(branches);
  if (output) {
    const dir = path.dirname(output);
    if (dir) {
      ensureDir(dir);
    }
    fs.writeFileSync(output, diagramText + "\n", { encoding: "utf-8" });
    console.log(`[OK] Mermaid diagram saved: ${output}`);
    return diagramText;
  }
  console.log("Mermaid diagram generated:");
  console.log(diagramText);
  return diagramText;
}
