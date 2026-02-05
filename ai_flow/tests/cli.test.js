const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const CLI_PATH = path.join(__dirname, "..", "dist", "cli.js");

function cleanupProjectDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    // best effort cleanup
  }
}

function runCli(args, cwd) {
  return spawnSync("node", [CLI_PATH, ...args], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "ai-flow-test",
      GIT_AUTHOR_EMAIL: "ai-flow-test@example.com",
      GIT_COMMITTER_NAME: "ai-flow-test",
      GIT_COMMITTER_EMAIL: "ai-flow-test@example.com",
    },
    encoding: "utf-8",
  });
}

function createTempProjectDir() {
  const prefix = path.join(os.tmpdir(), "ai-flow-cli-test-");
  return fs.mkdtempSync(prefix);
}

test("init-project scaffolds repository", () => {
  const projectDir = createTempProjectDir();
  try {
    const init = runCli(
      [
        "init-project",
        projectDir,
        "--title",
        "Integration Test",
        "--date",
        "2026-02-05",
      ],
      process.cwd()
    );
    assert.strictEqual(init.status, 0, `init failed: ${init.stderr}`);
    const expectedFiles = [
      "project.md",
      "plan.md",
      "journal.md",
      path.join("branches", "A", "branch-info.md"),
      path.join("branches", "A", "runs", "A_001", "prompt.md"),
    ];
    for (const relative of expectedFiles) {
      const absolute = path.join(projectDir, relative);
      assert.ok(fs.existsSync(absolute), `Missing ${relative}`);
    }
    const projectContent = fs.readFileSync(
      path.join(projectDir, "project.md"),
      "utf-8"
    );
    assert.ok(projectContent.includes("Integration Test"));
    assert.ok(projectContent.includes("2026-02-05"));
  } finally {
    cleanupProjectDir(projectDir);
  }
});

function setupFreshProject() {
  const projectDir = createTempProjectDir();
  const init = runCli(
    [
      "init-project",
      projectDir,
      "--title",
      "Time Test",
      "--date",
      "2026-02-05",
    ],
    process.cwd()
  );
  assert.strictEqual(init.status, 0, `init failed: ${init.stderr}`);
  return projectDir;
}

test("time commands record events", () => {
  const projectDir = setupFreshProject();
  try {
    const start = runCli(
      ["time", "start", projectDir, "--activity", "reading", "--note", "start note"],
      process.cwd()
    );
    assert.strictEqual(start.status, 0, `time start failed: ${start.stderr}`);
    const stop = runCli(
      ["time", "stop", projectDir, "--note", "stop note"],
      process.cwd()
    );
    assert.strictEqual(stop.status, 0, `time stop failed: ${stop.stderr}`);
    const logFile = path.join(projectDir, "time_log.md");
    assert.ok(fs.existsSync(logFile), "time_log.md missing");
    const logContent = fs.readFileSync(logFile, "utf-8");
    assert.ok(logContent.toLowerCase().includes("start"), "Missing start event");
    assert.ok(logContent.toLowerCase().includes("stop"), "Missing stop event");
    const report = runCli(
      ["time", "report", projectDir, "--date", "2026-02-05"],
      process.cwd()
    );
    assert.strictEqual(report.status, 0, `time report failed: ${report.stderr}`);
    const stdout = (report.stdout || "").trim();
    assert.ok(stdout.length > 0, "Empty report output");
  } finally {
    cleanupProjectDir(projectDir);
  }
});
