# Event Log & Replay

> **Audience:** devs · **Status:** draft · **Last updated:** 2026-10-27 · **Related:** [ARCHITECTURE](ARCHITECTURE.md) · [VERIFICATION](VERIFICATION.md)

Muse Code writes every model call, tool run, approval, and edit to a per-session **event log** as plain JSONL. Attest treats that log as the single source of truth: the attestation is *derived* from it, not written alongside it.

## Why it matters

- **Replay-exact:** a run can be reconstructed after the fact.
- **Crash-safe:** `muse resume` reads the log and continues from the last recorded step.
- **Auditable:** plain JSONL on disk — grep- and `jq`-able, no proprietary format.

## Location

```text
~/.local/share/muse/sessions/<YYYY>/<MM>/<DD>/<session-id>/session.jsonl
```

## Event shape (illustrative)

```json
{
  "ts": "2026-10-27T12:04:03.210Z",
  "session_id": "…",
  "agent": "worker-2",
  "event": {
    "kind": "tool_call",
    "tool": "edit_file",
    "args": { "path": "src/billing/api.ts" },
    "result": { "added": 42, "removed": 17 }
  }
}
```

Kinds we care about for the attestation:

| `kind` | Emitted when | Used for |
|---|---|---|
| `plan_approved` | Planner is approved | Proves the run matched an approved plan |
| `worktree_lifecycle` | Worktree changes state | Isolation evidence (`base_commit`, cleanup policy) |
| `tool_call` | Any tool run | The diff trail |
| `verification_step` | CUA verifier drives the app | Behaviour evidence |
| `verification_verdict` | Gate decides | Pass/fail per task |
| `merge` | Merge coordinator merges | What landed |

## Deriving the attestation

The **attestation emitter** reduces the log to a record:

1. The **diff** — from the merged children's commits.
2. The **trace** — the ordered events for the run (plan → worktrees → edits → verification).
3. The **before/after video** — from the verifier's screenshots.

Output → the [evidence page](ARCHITECTURE.md) and the PR body.

## Recipes

```bash
# Find every verification verdict in a run
F=~/.local/share/muse/sessions/$(date +%Y/%m/%d)/*/session.jsonl
jq -c 'select(.event.kind == "verification_verdict") | .event' $F

# List worktree lifecycles with their base commits
jq -c 'select(.event.kind == "worktree_lifecycle") | .event' $F
```

## Privacy note

Logs contain prompts, code, and context. They stay **on disk locally**; Attest does not upload them. On Contributor mode, content may be used by Meta to train models — check before running on proprietary code.

## See also

- [VERIFICATION](VERIFICATION.md) — what the verifier records
- [ARCHITECTURE](ARCHITECTURE.md) — where the emitter sits
