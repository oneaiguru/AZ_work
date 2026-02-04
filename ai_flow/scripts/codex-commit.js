#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const promptPath = path.join(repoRoot, "codex_commit_prompt.txt");

if (!fs.existsSync(promptPath)) {
  console.error(`Missing codex_commit_prompt.txt at ${promptPath}`);
  process.exit(1);
}

const runGit = (args) => {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  return stdout + stderr;
};

const status = runGit(["status", "--short"]);
const diff = runGit(["diff"]);
const prompt = fs.readFileSync(promptPath, "utf8");

const payload = `${prompt}\n\ngit status --short:\n${status}\n\ngit diff:\n${diff}\n`;
const tmpDir = path.join(repoRoot, ".tmp");
fs.mkdirSync(tmpDir, { recursive: true });
const payloadPath = path.join(tmpDir, "codex_commit_input.txt");
fs.writeFileSync(payloadPath, payload, "utf8");

const result = spawnSync("codex", [], {
  input: payload,
  encoding: "utf8",
  stdio: ["pipe", "inherit", "inherit"],
});

if (result.error && result.error.code === "ENOENT") {
  console.log(`Codex CLI not found. Input saved to ${payloadPath}`);
  process.exit(0);
}
