// owner: @e5d3e1 · why: applied migrations are immutable; editing one silently diverges existing DBs from fresh ones · review-by: 2027-02-24
// PreToolUse hook: blocks Edit/Write/MultiEdit on an APPLIED db/migrations/*.sql file (exit 2).
// "Applied" = committed in HEAD. A new migration (not yet committed) can be created and fixed.
// Paths are canonicalized (realpath), so a symlink alias cannot bypass the check.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const WATCHED_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0); // not our payload; never block on parse errors
}

const filePath = payload?.tool_input?.file_path;
if (!WATCHED_TOOLS.has(payload?.tool_name) || typeof filePath !== "string") process.exit(0);

// Resolve symlinks; for a file that does not exist yet, resolve its parent directory.
function canonical(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    try {
      return path.join(fs.realpathSync(path.dirname(p)), path.basename(p));
    } catch {
      return p;
    }
  }
}

// True if the file is committed in HEAD. If git cannot answer, treat it as applied (fail closed).
function isCommitted(rel) {
  try {
    const out = execFileSync("git", ["ls-tree", "--name-only", "HEAD", "--", rel], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim() !== "";
  } catch {
    return true;
  }
}

const root = canonical(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const migDir = canonical(path.join(root, "db/migrations"));
const abs = canonical(path.resolve(root, filePath));
const name = path.basename(abs);
const rel = `db/migrations/${name}`; // repo path used for git and messages
// Real location relative to root; differs from rel when db/migrations is a symlink inside the repo.
const realRel = path.relative(root, abs).split(path.sep).join("/");
const realInRepo = !realRel.startsWith("../") && !path.isAbsolute(realRel);

if (
  path.dirname(abs) === migDir &&
  name.endsWith(".sql") &&
  fs.existsSync(abs) &&
  (isCommitted(rel) || (realInRepo && isCommitted(realRel)))
) {
  const message =
    `BLOCKED: ${rel} is an applied migration and must not be edited. ` +
    `Add a new migration instead, e.g. db/migrations/NNN_<name>.sql (see AGENTS.md hard rules).`;
  try {
    fs.appendFileSync(
      path.join(root, ".claude/hooks/block.log"),
      `${new Date().toISOString()} ${payload.tool_name} ${rel}\n`,
    );
  } catch {
    // logging is best-effort
  }
  console.error(message);
  process.exit(2);
}

process.exit(0);
