# Demo Script

> **Audience:** team + judges · **Status:** draft · **Last updated:** 2026-10-27 · **Related:** [PITCH](PITCH.md) · [VERIFICATION](VERIFICATION.md)

A timed shot list. **TODO:** replace placeholders with the actual target repo and prompts after the build, and record real timings.

## Pre-roll (before the demo starts)

- Target repo cloned and installed; app boots clean.
- Muse Code authenticated; `/model` set to `muse-spark-1.3`.
- Plan approved ahead of time so the live segment is the *fan-out → verify → attest* loop.
- Terminal font large; event log tail running in a second pane.

## Shot list

| Time | Beat | On screen | Say |
|---|---|---|---|
| 0:00–0:15 | Hook | Title + the ">55% of mutants" stat | "Agents ship green CI and broken UIs. Tests aren't proof." |
| 0:15–0:35 | Intake | Paste the work item (issue or screen recording) | "Here's what we want. Attest turns it into a plan." |
| 0:35–0:55 | Plan | `/plan` output; approval prompt | "It grounds the plan in the real repo — and stops for approval." |
| 0:55–1:25 | Fan-out | `attest run` → 4 worktrees spawn in parallel | "Four tasks, four isolated worktrees. Nothing collides." |
| 1:25–1:45 | Escalation | Merge conflict → `/model muse-wonder-full` | "Only the hard 5% touches the frontier model." |
| 1:45–2:15 | **Verify** | CUA boots app, clicks the flow, SAM 3.1 segments the UI | "A separate agent drives the real app — the code can't declare victory." |
| 2:15–2:35 | Attest | Evidence page: diff + trace + before/after video | "Every accepted change ships with a replayable record." |
| 2:35–2:50 | Payoff | Merge the PR; show the failing-case re-run | "If it doesn't work, it reopens automatically." |
| 2:50–3:00 | Close | Repo + artifact link | "Verified delivery, today." |

## Failure fallback

If a live verification run stalls, cut to the **recorded** run in `docs/assets/` and narrate over it — never wait live on stage. Keep a pre-recorded full run as backup.

## Capture checklist

- [ ] `01-intake.gif`, `02-fanout.gif`, `03-verify.gif`, `04-attest.gif` captured from a **real** run
- [ ] Before/after video exported
- [ ] Evidence page screenshot for the README and artifact
- [ ] All assets < 5 MB, in `docs/assets/`
