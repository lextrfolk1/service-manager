const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

function runGit(args, cwd, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, timeout }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        return reject(err);
      }
      resolve((stdout || "").trim());
    });
  });
}

async function isGitRepository(dir) {
  if (!dir || typeof dir !== "string" || !fs.existsSync(dir)) {
    return false;
  }
  try {
    const res = await runGit(["rev-parse", "--is-inside-work-tree"], dir);
    return res === "true";
  } catch {
    return false;
  }
}

const NOT_A_REPO = {
  isGitRepo: false,
  currentBranch: null,
  isDirty: false,
  uncommittedCount: 0,
  ahead: 0,
  behind: 0,
  hasUpstream: false,
  upstreamBranch: null
};

// One `git status --porcelain=v2 --branch` call reports branch, upstream, ahead/behind and changed files.
async function getGitInfo(dir) {
  if (!dir || typeof dir !== "string" || !fs.existsSync(dir)) {
    return { ...NOT_A_REPO };
  }

  let statusOut;
  try {
    statusOut = await runGit(["status", "--porcelain=v2", "--branch"], dir);
  } catch {
    return { ...NOT_A_REPO };
  }

  let oid = null;
  let head = null;
  let upstreamBranch = null;
  let ahead = 0;
  let behind = 0;
  let hasAheadBehind = false;
  let uncommittedCount = 0;

  for (const line of statusOut.split("\n")) {
    if (!line) continue;
    if (line.startsWith("# branch.oid ")) {
      oid = line.slice("# branch.oid ".length);
    } else if (line.startsWith("# branch.head ")) {
      head = line.slice("# branch.head ".length);
    } else if (line.startsWith("# branch.upstream ")) {
      upstreamBranch = line.slice("# branch.upstream ".length);
    } else if (line.startsWith("# branch.ab ")) {
      const [aheadPart, behindPart] = line.slice("# branch.ab ".length).split(" ");
      ahead = Math.abs(parseInt(aheadPart, 10)) || 0;
      behind = Math.abs(parseInt(behindPart, 10)) || 0;
      hasAheadBehind = true;
    } else if (!line.startsWith("#")) {
      uncommittedCount += 1;
    }
  }

  let currentBranch;
  if (head && head !== "(detached)") {
    currentBranch = head;
  } else if (oid && oid !== "(initial)") {
    currentBranch = `HEAD (${oid.slice(0, 7)})`;
  } else {
    currentBranch = "unknown";
  }

  // branch.ab is only reported when the upstream exists, matching the old @{upstream} check.
  const hasUpstream = Boolean(upstreamBranch && hasAheadBehind);

  return {
    isGitRepo: true,
    currentBranch,
    isDirty: uncommittedCount > 0,
    uncommittedCount,
    ahead,
    behind,
    hasUpstream,
    upstreamBranch: hasUpstream ? upstreamBranch : null
  };
}

async function getGitBranches(dir, shouldFetch = false) {
  const isRepo = await isGitRepository(dir);
  if (!isRepo) {
    return {
      isGitRepo: false,
      currentBranch: null,
      localBranches: [],
      remoteBranches: [],
      remotes: [],
      isDirty: false,
      uncommittedCount: 0,
      ahead: 0,
      behind: 0,
      hasUpstream: false,
      upstreamBranch: null
    };
  }

  let remotes = [];
  try {
    const rawRemotes = await runGit(["remote"], dir, 5000);
    remotes = rawRemotes.split("\n").map((r) => r.trim()).filter(Boolean);
  } catch {
    // Ignore remote detection error
  }

  if (shouldFetch && remotes.length > 0) {
    try {
      await runGit(["fetch", "--prune"], dir, 12000);
    } catch (e) {
      console.warn(`Git fetch failed for ${dir}:`, e.message);
    }
  }

  const info = await getGitInfo(dir);
  const localBranches = [];
  const remoteBranches = [];

  try {
    const rawBranches = await runGit(["branch", "-a", "--format=%(refname:short)|%(HEAD)"], dir);
    const lines = rawBranches.split("\n").map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      const parts = line.split("|");
      const name = parts[0].trim();
      if (!name || name.includes("HEAD") || name === "origin") continue;

      if (name.startsWith("origin/") || name.startsWith("remotes/")) {
        const cleanName = name.replace(/^remotes\//, "");
        if (!remoteBranches.includes(cleanName)) {
          remoteBranches.push(cleanName);
        }
      } else {
        if (!localBranches.includes(name)) {
          localBranches.push(name);
        }
      }
    }
  } catch (e) {
    console.error(`Failed to list git branches for ${dir}:`, e.message);
  }

  if (info.currentBranch && !info.currentBranch.startsWith("HEAD (") && !localBranches.includes(info.currentBranch)) {
    localBranches.unshift(info.currentBranch);
  }

  return {
    isGitRepo: true,
    currentBranch: info.currentBranch,
    localBranches,
    remoteBranches,
    remotes,
    isDirty: info.isDirty,
    uncommittedCount: info.uncommittedCount,
    ahead: info.ahead,
    behind: info.behind,
    hasUpstream: info.hasUpstream,
    upstreamBranch: info.upstreamBranch
  };
}

async function checkoutBranch(dir, branchName) {
  if (!branchName || typeof branchName !== "string") {
    throw new Error("Invalid branch name specified");
  }

  const cleanBranch = branchName.trim();
  if (cleanBranch.startsWith("-")) {
    throw new Error("Invalid branch name specified");
  }

  const isRepo = await isGitRepository(dir);
  if (!isRepo) {
    throw new Error(`Directory ${dir} is not a git repository`);
  }

  let target = cleanBranch;
  if (target.startsWith("origin/")) {
    target = target.slice("origin/".length);
  }

  try {
    const output = await runGit(["checkout", target], dir);
    const info = await getGitInfo(dir);
    return {
      success: true,
      currentBranch: info.currentBranch,
      output,
      ...info
    };
  } catch (err) {
    const stderr = err.stderr || err.message || "";
    if (stderr.includes("overwritten by checkout") || stderr.includes("local changes")) {
      throw new Error("Cannot switch branch: working directory has uncommitted changes that would be overwritten. Please commit or stash your changes.");
    }
    throw new Error(`Git checkout failed: ${stderr || err.message}`);
  }
}

// True when the current branch tracks an upstream that still exists locally
// (false for local-only branches or upstreams that are gone from the remote).
async function hasUpstream(dir) {
  try {
    await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], dir, 3000);
    return true;
  } catch {
    return false;
  }
}

async function pullBranch(dir) {
  const isRepo = await isGitRepository(dir);
  if (!isRepo) {
    throw new Error(`Directory ${dir} is not a git repository`);
  }

  try {
    const output = await runGit(["pull"], dir, 30000);
    const info = await getGitInfo(dir);
    return {
      success: true,
      output,
      ...info
    };
  } catch (err) {
    const stderr = err.stderr || err.message || "";
    if (
      stderr.includes("Please commit your changes") ||
      stderr.includes("overwritten by merge") ||
      stderr.includes("local changes")
    ) {
      throw new Error(
        "Cannot pull: working directory has uncommitted changes that would be overwritten by merge. Please commit or stash your changes."
      );
    }
    if (stderr.includes("There is no tracking information") || stderr.includes("no tracking info")) {
      throw new Error("No upstream tracking branch configured for this branch. Run 'git push -u origin <branch>' first.");
    }
    throw new Error(`Git pull failed: ${stderr || err.message}`);
  }
}

// Publish the current local branch to the remote and set it as upstream.
async function pushBranch(dir) {
  const isRepo = await isGitRepository(dir);
  if (!isRepo) {
    throw new Error(`Directory ${dir} is not a git repository`);
  }

  const branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], dir, 3000);
  if (!branch || branch === "HEAD") {
    throw new Error("Cannot push: HEAD is detached. Check out a branch first.");
  }

  const remotes = (await runGit(["remote"], dir, 5000)).split("\n").map((r) => r.trim()).filter(Boolean);
  if (remotes.length === 0) {
    throw new Error("Cannot push: no git remote is configured for this repository.");
  }
  const remote = remotes.includes("origin") ? "origin" : remotes[0];

  try {
    const output = await runGit(["push", "-u", remote, branch], dir, 60000);
    const info = await getGitInfo(dir);
    return {
      success: true,
      remote,
      output,
      ...info
    };
  } catch (err) {
    const stderr = err.stderr || err.message || "";
    throw new Error(`Git push failed: ${stderr || err.message}`);
  }
}

module.exports = {
  runGit,
  isGitRepository,
  getGitInfo,
  getGitBranches,
  checkoutBranch,
  pullBranch,
  hasUpstream,
  pushBranch
};
