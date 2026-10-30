# Setup (Runbook)

> **Audience:** devs · **Status:** draft · **Last updated:** 2026-10-27 · **Related:** [MODEL_STRATEGY](MODEL_STRATEGY.md)

Get Attest running locally.

## 1. Install Muse Code

```bash
# macOS / Linux
curl -fsSL https://dev.meta.ai/install.sh | sh

# Windows (PowerShell)
irm https://dev.meta.ai/install.ps1 | iex

muse --version    # verify (expect 1.4.x)
```

## 2. Authenticate

On first run `muse` offers a browser sign-in or an API key:

```bash
muse
```

For scripted/CI use, set the API key as an environment variable:

```bash
export MODEL_API_KEY=...   # Meta Model API key
# on Windows: setx MODEL_API_KEY "..."
```

## 3. Clone and install Attest

```bash
git clone <this-repo> attest && cd attest
# TypeScript project
npm install
```

## 4. Pick models

```text
/model                    # opens the picker
/model muse-spark-1.3     # default worker model
```

Muse Wonder Full requires the **Power ($50)** or **Maximum ($200)** plan — select it from the picker (no public ID).

## 5. Run

```bash
cd /path/to/target-repo
attest run "fix the failing checkout test and prove it works in the browser"
```

Approve the plan when prompted; Attest then fans out, verifies, and produces the evidence page.

## 6. Where things land

| What | Where |
|---|---|
| Event log | `~/.local/share/muse/sessions/<date>/<session>/session.jsonl` |
| Worktrees | `.muse/worktrees/` in the target repo |
| Evidence page | printed at the end of the run |
| Settings / Contributor toggle | `/settings` inside `muse` |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/model <id>` unrecognised | Update Muse Code (`muse --version`, rerun installer) |
| No parallel workers | Enable isolation: `muse --subagent-worktree-isolation` |
| Audio input quality poor | Use `muse-spark-1.2` or Muse Voice Transcribe |
| Run died / machine slept | `muse resume` — continues from the event log |
| Allowance draining oddly | Check Contributor mode in `/settings`; re-check after a refresh |

## Platform notes

- **Windows:** Muse Code runs commands in PowerShell; voice and inter-session messaging are unavailable.
- **Wonder / Wonder Full:** unavailable in South Korea (API and Muse Code).
