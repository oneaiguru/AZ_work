import fs from "node:fs";
import path from "node:path";
import { spawnSync, SpawnSyncReturns } from "node:child_process";

type GitResult = SpawnSyncReturns<string>;

export function runGit(projectPath: string, args: string[], env?: NodeJS.ProcessEnv): GitResult | null {
  try {
    const result = spawnSync("git", args, {
      cwd: projectPath,
      encoding: "utf-8",
      env: env ?? process.env,
    });
    if (result.stdout) {
      const trimmed = result.stdout.trim();
      if (trimmed) {
        console.log(trimmed);
      }
    }
    if (result.stderr) {
      const trimmed = result.stderr.trim();
      if (trimmed && result.status !== 0) {
        console.error(trimmed);
      }
    }
    return result;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[WARN] git unavailable: ${error.message}`);
    }
    return null;
  }
}

export function ensureGitRepo(projectPath: string): boolean {
  const gitDir = path.join(projectPath, ".git");
  if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
    return true;
  }
  const proc = runGit(projectPath, ["init"]);
  if (proc && proc.status === 0) {
    console.log(`[OK]   Initialized git repository: ${projectPath}`);
    return true;
  }
  console.error("[WARN] Failed to initialize git repository.");
  return false;
}

function gitHasHead(projectPath: string): boolean {
  const gitDir = path.join(projectPath, ".git");
  if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
    return false;
  }
  const proc = runGit(projectPath, ["rev-parse", "--verify", "HEAD"]);
  return Boolean(proc && proc.status === 0);
}

export function gitBranchExists(projectPath: string, branch: string): boolean {
  if (!gitHasHead(projectPath)) {
    return false;
  }
  const proc = runGit(projectPath, ["rev-parse", "--verify", "--quiet", branch]);
  return Boolean(proc && proc.status === 0);
}

export function gitCurrentBranch(projectPath: string): string | null {
  if (!gitHasHead(projectPath)) {
    return null;
  }
  const proc = runGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!proc || proc.status !== 0 || !proc.stdout) {
    return null;
  }
  return proc.stdout.trim();
}

export function gitCreateBranch(projectPath: string, branch: string, base?: string): void {
  if (!ensureGitRepo(projectPath)) {
    return;
  }
  if (gitBranchExists(projectPath, branch)) {
    return;
  }
  if (!gitHasHead(projectPath)) {
    return;
  }
  if (base && gitBranchExists(projectPath, base)) {
    runGit(projectPath, ["branch", branch, base]);
  } else {
    runGit(projectPath, ["branch", branch]);
  }
}

export function gitCheckoutBranch(projectPath: string, branch: string, base?: string): void {
  if (!ensureGitRepo(projectPath)) {
    return;
  }
  if (gitBranchExists(projectPath, branch)) {
    runGit(projectPath, ["checkout", branch]);
    return;
  }
  const args = ["checkout", "-b", branch];
  if (base && gitBranchExists(projectPath, base)) {
    args.push(base);
  }
  runGit(projectPath, args);
}

export function gitStageAll(projectPath: string): GitResult | null {
  return runGit(projectPath, ["add", "--all"]);
}

export function gitCommit(projectPath: string, message: string): GitResult | null {
  let env: NodeJS.ProcessEnv | undefined;
  const name = gitConfigGet(projectPath, "user.name");
  const email = gitConfigGet(projectPath, "user.email");
  if (!name || !email) {
    env = { ...process.env };
    env.GIT_AUTHOR_NAME = env.GIT_AUTHOR_NAME || "AI Flow CLI";
    env.GIT_AUTHOR_EMAIL = env.GIT_AUTHOR_EMAIL || "ai_flow@example.com";
    env.GIT_COMMITTER_NAME = env.GIT_COMMITTER_NAME || env.GIT_AUTHOR_NAME;
    env.GIT_COMMITTER_EMAIL = env.GIT_COMMITTER_EMAIL || env.GIT_AUTHOR_EMAIL;
  }
  return runGit(projectPath, ["commit", "-m", message], env);
}

export function gitConfigGet(projectPath: string, key: string): string | null {
  const proc = runGit(projectPath, ["config", "--get", key]);
  if (!proc || proc.status !== 0 || !proc.stdout) {
    return null;
  }
  return proc.stdout.trim();
}

export function gitIsClean(projectPath: string): boolean | null {
  const gitDir = path.join(projectPath, ".git");
  if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
    return null;
  }
  const proc = runGit(projectPath, ["status", "--porcelain"]);
  if (!proc || proc.status !== 0) {
    return null;
  }
  return !(proc.stdout || "").trim();
}
