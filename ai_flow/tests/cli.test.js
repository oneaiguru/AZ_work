const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const CLI_PATH = path.join(__dirname, "..", "dist", "index.js");

function runCli(args) {
  return spawnSync("node", [CLI_PATH, ...args], {
    env: process.env,
    encoding: "utf-8",
  });
}

function createTempDir() {
  const prefix = path.join(os.tmpdir(), "ai-flow-cli-test-");
  return fs.mkdtempSync(prefix);
}

function cleanupProjectDir(projectDir) {
  fs.rmSync(projectDir, { recursive: true, force: true });
}

test("init-project scaffolds files", () => {
  const projectDir = createTempDir();
  try {
    const res = runCli(["init-project", projectDir, "--title", "E2E", "--date", "2026-02-05"]);
    assert.strictEqual(res.status, 0, `init-project failed: ${res.stderr}`);
    const files = ["project.md", "plan.md", "journal.md", "time_log.md"];
    for (const file of files) {
      assert.ok(fs.existsSync(path.join(projectDir, file)), `Missing ${file}`);
    }
    const projectContent = fs.readFileSync(path.join(projectDir, "project.md"), "utf-8");
    assert.ok(projectContent.includes("E2E"));
    assert.ok(projectContent.includes("2026-02-05"));
  } finally {
    cleanupProjectDir(projectDir);
  }
});

test("time start/stop/report produce entries", () => {
  const projectDir = createTempDir();
  try {
    const init = runCli(["init-project", projectDir]);
    assert.strictEqual(init.status, 0);
    const start = runCli(["time", "start", projectDir, "--activity", "coding", "--note", "start note"]);
    assert.strictEqual(start.status, 0, start.stderr);
    const stop = runCli(["time", "stop", projectDir, "--note", "stop note"]);
    assert.strictEqual(stop.status, 0, stop.stderr);
    const report = runCli(["time", "report", projectDir, "--date", new Date().toISOString().slice(0, 10)]);
    assert.strictEqual(report.status, 0, report.stderr);
    assert.ok(report.stdout.includes("Total events"), "Report should include summary");
  } finally {
    cleanupProjectDir(projectDir);
  }
});

test("branch workflow and diagram via CLI", () => {
  const projectDir = createTempDir();
  try {
    const init = runCli(["init-project", projectDir]);
    assert.strictEqual(init.status, 0, `init failed: ${init.stderr}`);
    const create = runCli(["create-branch", projectDir, "B_alt", "--parent", "A"]);
    assert.strictEqual(create.status, 0, create.stderr);
    const branchPath = path.join(projectDir, "branches", "B_alt");
    assert.ok(fs.existsSync(branchPath), "Branch directory missing");
    const step = runCli(["new-step", projectDir, "--branch-id", "B_alt"]);
    assert.strictEqual(step.status, 0, step.stderr);
    const stepDir = path.join(branchPath, "runs", "B_alt_002");
    assert.ok(fs.existsSync(stepDir), "Step directory missing");
    const diagram = runCli(["diagram", projectDir]);
    assert.strictEqual(diagram.status, 0, diagram.stderr);
    assert.ok(diagram.stdout.includes("graph TD"), "Diagram output missing nodes");
  } finally {
    cleanupProjectDir(projectDir);
  }
});
