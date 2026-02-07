import fs from "node:fs";
import path from "node:path";
import fastify, { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import {
  BRANCH_STATUSES,
  SUPPORTED_ACTIVITIES,
  createBranch,
  diagram,
  initProject,
  listProjects,
  newStep,
  recordTimeEvent,
  switchBranch,
  timeReport,
} from "./project";

const STATIC_DIR = path.resolve(__dirname, "..", "static");
const INDEX_HTML = path.join(STATIC_DIR, "index.html");

function normalizeDir(dir: string) {
  return path.normalize(dir).replace(/[\\/]+$/, "");
}

type ResolveResult = { path?: string; error?: string };

function resolveProjectPath(baseDir: string, raw: string | undefined, mustExist = false): ResolveResult {
  if (!raw || !raw.trim()) {
    return { error: "Project path is required." };
  }
  const candidate = raw.trim();
  const abs = path.resolve(path.isAbsolute(candidate) ? candidate : path.join(baseDir, candidate));
  const normalizedBase = normalizeDir(baseDir);
  const normalizedAbs = normalizeDir(abs);
  if (normalizedAbs === normalizedBase) {
    if (mustExist && !fs.existsSync(abs)) {
      return { error: "Project path does not exist." };
    }
    return { path: abs };
  }
  if (!normalizedAbs.startsWith(`${normalizedBase}${path.sep}`)) {
    return { error: `Project path must be inside ${baseDir}.` };
  }
  if (mustExist && !fs.existsSync(abs)) {
    return { error: "Project path does not exist." };
  }
  if (!mustExist && fs.existsSync(abs) && !fs.statSync(abs).isDirectory()) {
    return { error: "Project path exists and is not a directory." };
  }
  return { path: abs };
}

export interface WebServerOptions {
  baseDir?: string;
  port?: number;
  host?: string;
  logger?: boolean;
}

export function buildWebServer(options: WebServerOptions = {}): FastifyInstance {
  const baseDir = path.resolve(options.baseDir || process.cwd());
  fs.mkdirSync(baseDir, { recursive: true });
  const server = fastify({ logger: options.logger ?? false });
  server.register(fastifyStatic, {
    root: STATIC_DIR,
    prefix: "/static/",
  });

  server.get("/", async (_, reply) => {
    if (!fs.existsSync(INDEX_HTML)) {
      return reply.status(404).send("Web UI is not built yet.");
    }
    return reply.type("text/html").send(fs.readFileSync(INDEX_HTML, "utf-8"));
  });

  server.get("/projects", async () => ({ projects: listProjects(baseDir) }));

  server.post("/api/init", async (request, reply) => {
    const body = request.body as { project_path?: string; title?: string; date?: string };
    const resolved = resolveProjectPath(baseDir, body?.project_path, false);
    if (resolved.error) {
      return reply.status(400).send({ ok: false, error: resolved.error });
    }
    try {
      const projectPath = initProject(resolved.path!, { title: body?.title, date: body?.date });
      return { ok: true, project_path: projectPath };
    } catch (error) {
      return reply.status(500).send({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  server.post("/api/create-branch", async (request, reply) => {
    const payload = request.body as {
      project_path?: string;
      branch_id?: string;
      title?: string;
      parent?: string;
      from_step?: string;
      status?: string;
      closed_reason?: string;
      skip_git_check?: boolean;
    };
    const resolved = resolveProjectPath(baseDir, payload.project_path, true);
    if (resolved.error) {
      return reply.status(400).send({ ok: false, error: resolved.error });
    }
    const status = (payload.status || "experiment").trim();
    if (!BRANCH_STATUSES.includes(status as (typeof BRANCH_STATUSES)[number])) {
      return reply.status(400).send({ ok: false, error: `Status must be one of: ${BRANCH_STATUSES.join(", ")}` });
    }
    try {
      const branchId = createBranch(resolved.path!, payload.branch_id, {
        title: payload.title,
        parent: payload.parent,
        fromStep: payload.from_step,
        status: status as (typeof BRANCH_STATUSES)[number],
        closedReason: payload.closed_reason,
        skipGitCheck: Boolean(payload.skip_git_check),
      });
      return { ok: true, branch_id: branchId, project_path: resolved.path };
    } catch (error) {
      return reply.status(500).send({ ok: false, error: error instanceof Error ? error.message : "Branch creation failed" });
    }
  });

  server.post("/api/new-step", async (request, reply) => {
    const payload = request.body as {
      project_path?: string;
      branch_id?: string;
      step_id?: string;
      from_step?: string;
      skip_git_check?: boolean;
    };
    const resolved = resolveProjectPath(baseDir, payload.project_path, true);
    if (resolved.error) {
      return reply.status(400).send({ ok: false, error: resolved.error });
    }
    try {
      const stepId = newStep(resolved.path!, {
        branchId: payload.branch_id,
        stepId: payload.step_id,
        fromStep: payload.from_step,
        skipGitCheck: Boolean(payload.skip_git_check),
      });
      return { ok: true, step_id: stepId, project_path: resolved.path };
    } catch (error) {
      return reply.status(500).send({ ok: false, error: error instanceof Error ? error.message : "Step creation failed" });
    }
  });

  server.post("/api/switch", async (request, reply) => {
    const payload = request.body as {
      project_path?: string;
      branch_id?: string;
      step?: string;
      skip_git_check?: boolean;
    };
    const resolved = resolveProjectPath(baseDir, payload.project_path, true);
    if (resolved.error) {
      return reply.status(400).send({ ok: false, error: resolved.error });
    }
    try {
      const branch = switchBranch(resolved.path!, {
        branchId: payload.branch_id,
        stepId: payload.step,
        skipGitCheck: Boolean(payload.skip_git_check),
      });
      return { ok: true, branch, project_path: resolved.path };
    } catch (error) {
      return reply.status(500).send({ ok: false, error: error instanceof Error ? error.message : "Switch failed" });
    }
  });

  server.post("/api/diagram", async (request, reply) => {
    const payload = request.body as { project_path?: string; output?: string };
    const resolved = resolveProjectPath(baseDir, payload.project_path, true);
    if (resolved.error) {
      return reply.status(400).send({ ok: false, error: resolved.error });
    }
    try {
      const diagramText = diagram(resolved.path!, payload.output);
      return { ok: true, diagram: diagramText, project_path: resolved.path };
    } catch (error) {
      return reply.status(500).send({ ok: false, error: error instanceof Error ? error.message : "Diagram generation failed" });
    }
  });

  server.post("/api/time/:action", async (request, reply) => {
    const action = (request.params as { action: string }).action;
    if (!["start", "stop"].includes(action)) {
      return reply.status(400).send({ ok: false, error: "Action must be start or stop." });
    }
    const body = request.body as { project_path?: string; activity?: string; note?: string };
    const resolved = resolveProjectPath(baseDir, body?.project_path, true);
    if (resolved.error) {
      return reply.status(400).send({ ok: false, error: resolved.error });
    }
    try {
      const options: { activity?: string; note?: string } = {};
      if (action === "start") {
        const activity = (body?.activity || "coding").trim();
        if (!SUPPORTED_ACTIVITIES.includes(activity as (typeof SUPPORTED_ACTIVITIES)[number])) {
          return reply.status(400).send({ ok: false, error: `Activity must be one of: ${SUPPORTED_ACTIVITIES.join(", ")}` });
        }
        options.activity = activity;
      }
      if (body?.note) {
        options.note = body.note;
      }
      recordTimeEvent(resolved.path!, action as "start" | "stop", options);
      return { ok: true, action, project_path: resolved.path };
    } catch (error) {
      return reply.status(500).send({ ok: false, error: error instanceof Error ? error.message : "Write error" });
    }
  });

  server.get("/api/time/report", async (request, reply) => {
    const query = request.query as { project_path?: string; date?: string; range?: string };
    const resolved = resolveProjectPath(baseDir, query?.project_path, true);
    if (resolved.error) {
      return reply.status(400).send({ ok: false, error: resolved.error });
    }
    try {
      const report = timeReport(resolved.path!, { date: query?.date, range: query?.range });
      return { ok: true, report, project_path: resolved.path };
    } catch (error) {
      return reply.status(500).send({ ok: false, error: error instanceof Error ? error.message : "Report error" });
    }
  });

  return server;
}

export async function startWebServer(options: WebServerOptions = {}) {
  const server = buildWebServer(options);
  const port = options.port ?? 8000;
  const host = options.host ?? "0.0.0.0";
  await server.listen({ port, host });
  return server;
}
