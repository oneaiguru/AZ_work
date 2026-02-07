import path from "node:path";
import { Command } from "commander";
import {
  BRANCH_STATUSES,
  BranchStatus,
  SUPPORTED_ACTIVITIES,
  createBranch,
  diagram,
  initProject,
  newStep,
  recordTimeEvent,
  switchBranch,
  timeReport,
} from "./project";
import { startWebServer } from "./web";

function wrapAsync<T extends any[]>(action: (...args: T) => Promise<void> | void) {
  return async (...args: T) => {
    try {
      await action(...args);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  };
}

export function buildCli() {
  const program = new Command();
  program.name("ai-flow").description("AI Flow CLI").version("0.1.0");

  program
    .command("init-project <projectPath>")
    .description("Create a new AI Flow project scaffold")
    .option("--title <title>", "Project title")
    .option("--date <date>", "Project start date in YYYY-MM-DD")
      .action(
        wrapAsync((projectPath: string, options: { title?: string; date?: string }) => {
          const resolved = initProject(projectPath, { title: options.title, date: options.date });
          console.log(`Project initialized at ${resolved}`);
        })
      );

  program
    .command("create-branch <projectPath> [branchId]")
    .alias("cb")
    .description("Add a new branch with its first step")
    .option("--branch-id <branchId>", "Branch identifier (eg. A_main)")
    .option("--title <title>", "Branch title")
    .option("--parent <parent>", "Parent branch id")
    .option("--from-step <fromStep>", "Reference step (eg. A_002)")
    .option("--status <status>", `Status (${BRANCH_STATUSES.join(", ")})`, "experiment")
    .option("--closed-reason <reason>", "Reason when branch is closed")
    .option("--skip-git-check", "Skip git clean check")
      .action(
    wrapAsync((projectPath: string, branchId: string | undefined, options: any) => {
      const status = (options.status as BranchStatus) || "experiment";
      const branch = createBranch(projectPath, branchId || options.branchId, {
            title: options.title,
            parent: options.parent,
            fromStep: options.fromStep,
            status,
            closedReason: options.closedReason,
            skipGitCheck: !!options.skipGitCheck,
          });
          console.log(`Branch created: ${branch}`);
        })
      );

  program
    .command("new-step <projectPath>")
    .alias("ns")
    .description("Create a new step in a branch (commits into branch/step)")
    .option("--branch-id <branchId>", "Branch identifier")
    .option("--step-id <stepId>", "Explicit step id")
    .option("--from-step <fromStep>", "Parent step for context")
    .option("--skip-git-check", "Skip git clean check")
      .action(
        wrapAsync((projectPath: string, options: any) => {
          const step = newStep(projectPath, {
            branchId: options.branchId,
            stepId: options.stepId,
            fromStep: options.fromStep,
            skipGitCheck: !!options.skipGitCheck,
          });
          console.log(`New step created: ${step}`);
        })
      );

  program
    .command("switch [projectPath]")
    .alias("s")
    .description("Switch git branch for project/step")
    .option("--branch-id <branchId>", "Override branch id")
    .option("--step <stepId>", "Switch directly to step branch")
    .option("--skip-git-check", "Skip git clean check")
      .action(
        wrapAsync((projectPath = ".", options: any) => {
          const target = switchBranch(projectPath, {
            branchId: options.branchId,
            stepId: options.step,
            skipGitCheck: !!options.skipGitCheck,
          });
          console.log(`Now on ${target}`);
        })
      );

  program
    .command("diagram <projectPath>")
    .description("Generate Mermaid diagram of branches/steps")
    .option("--output <output>", "Path to save diagram")
      .action(
        wrapAsync((projectPath: string, options: { output?: string }) => {
          diagram(projectPath, options.output);
        })
      );

  const time = program.command("time").description("Manage time tracking");

  time
    .command("start <projectPath>")
    .description("Log start of an activity")
    .option("--activity <activity>", `One of ${SUPPORTED_ACTIVITIES.join(", ")}`)
    .option("--note <note>", "Optional note")
      .action(
        wrapAsync((projectPath: string, options: { activity?: string; note?: string }) => {
          const activity = (options.activity || "coding").trim();
          if (!SUPPORTED_ACTIVITIES.includes(activity as typeof SUPPORTED_ACTIVITIES[number])) {
            throw new Error(`Activity must be one of: ${SUPPORTED_ACTIVITIES.join(", ")}`);
          }
          recordTimeEvent(projectPath, "start", { activity, note: options.note });
          console.log(`Start logged for ${path.resolve(projectPath)} (${activity})`);
        })
      );

  time
    .command("stop <projectPath>")
    .description("Log stop of an activity")
    .option("--note <note>", "Optional note")
      .action(
        wrapAsync((projectPath: string, options: { note?: string }) => {
          recordTimeEvent(projectPath, "stop", { note: options.note });
          console.log(`Stop logged for ${path.resolve(projectPath)}`);
        })
      );

  time
    .command("report <projectPath>")
    .description("Show time entries")
    .option("--date <date>", "Filter by YYYY-MM-DD")
    .option("--range <range>", "Filter by range YYYY-MM-DD,YYYY-MM-DD")
      .action(
        wrapAsync((projectPath: string, options: { date?: string; range?: string }) => {
          const report = timeReport(projectPath, { date: options.date, range: options.range });
          console.log(report);
        })
      );

  program
    .command("web")
    .description("Start the bundled web UI")
    .option("--port <port>", "Port to listen on", "8000")
    .option("--base-dir <baseDir>", "Root directory for projects", process.cwd())
      .action(
        wrapAsync(async (options: { port?: string; baseDir?: string }) => {
          const port = Number(options.port) || 8000;
          const baseDir = options.baseDir || process.cwd();
          const server = await startWebServer({ port, baseDir });
          server.log.info(`Web UI listening at http://0.0.0.0:${port}`);
        })
      );

  return program;
}
