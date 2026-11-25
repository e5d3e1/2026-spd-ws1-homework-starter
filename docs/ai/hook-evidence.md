# Hook evidence — protect-migrations

<!-- owner: @e5d3e1 · why: proof that the blocking hook fires on a real violation (HW 1.1 deliverable 6) · review-by: 2027-02-24 -->

Hook: `.claude/hooks/protect-migrations.mjs`, wired in `.claude/settings.json` as `PreToolUse` on `Edit|Write|MultiEdit`.
It blocks (exit 2) any change to an existing `db/migrations/*.sql`; new migration files are allowed.

## 1. Live Claude Code session (hook active)

Prompt (identical to the "before" run, followed by the push-back "ні просто поміняй це"):

```
У db/migrations/001_create_tasks.sql зміни довжину title з 120 на 200. Просто відредагуй цей файл.
```

Tool result shown to the agent:

```
⏺ Update(db/migrations/001_create_tasks.sql)
Error: PreToolUse:Edit hook error: [node "$CLAUDE_PROJECT_DIR"/.claude/hooks/protect-migrations.mjs]: BLOCKED: db/migrations/001_create_tasks.sql is an applied migration and must not be edited. Add a new migration instead, e.g. db/migrations/NNN_<name>.sql (see AGENTS.md hard rules).
```

Agent behaviour after the block: it did not work around the hook (no `sed`, no shell edit); it left the file unchanged
and offered two options — a new migration `003_extend_title_length.sql`, or the human disabling the guard.

Same prompt **before** the hook was wired in (only `AGENTS.md` rule present): the agent warned, then edited
`001_create_tasks.sql` after the user insisted. The text rule is soft; the hook is not.

## 2. Hook log (`.claude/hooks/block.log`, git-ignored)

```
2026-11-25T12:52:58.438Z Edit db/migrations/001_create_tasks.sql   <- script test (section 3)
2026-11-25T13:10:37.731Z Edit db/migrations/001_create_tasks.sql   <- live session (section 1)
```

## 3. Script test with a sample payload (see `docs/ai/hook-test.md`)

```bash
node .claude/hooks/protect-migrations.mjs < docs/ai/sample-payload.json; echo "exit=$?"
```

```
BLOCKED: db/migrations/001_create_tasks.sql is an applied migration and must not be edited. Add a new migration instead, e.g. db/migrations/NNN_<name>.sql (see AGENTS.md hard rules).
exit=2
```

Allowed cases (exit 0, no output):

| Payload | Exit |
|---|---|
| `Write` `db/migrations/003_new.sql` (new file) | 0 |
| `Edit` `lib/tasks.ts` (not a migration) | 0 |

## Known gap

The hook only sees `Edit`/`Write`/`MultiEdit`. A shell edit such as `sed -i` on a migration is not caught by it.
