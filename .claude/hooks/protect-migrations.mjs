// owner: @<github-handle> · why: applied migrations are immutable; editing one silently diverges existing DBs from fresh ones · review-by: 2027-02-24
// PreToolUse hook: blocks Edit/Write/MultiEdit on an EXISTING db/migrations/*.sql file (exit 2).
// Creating a new migration file is allowed.
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

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const abs = path.resolve(root, filePath);
const rel = path.relative(root, abs).split(path.sep).join("/");

if (/^db\/migrations\/[^/]+\.sql$/.test(rel) && fs.existsSync(abs)) {
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
