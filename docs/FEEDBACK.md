# Feedback

> **Audience:** team · **Status:** draft · **Last updated:** 2026-10-28 · **Related:** [COMPETITIVE_LANDSCAPE](COMPETITIVE_LANDSCAPE.md) · [VERIFICATION](VERIFICATION.md) · [ROADMAP](ROADMAP.md)

An outside review of the idea, the docs, and the scaffold as of 2026-10-28.

## The idea in one line

Coding agents can't be trusted to say their own work is done, so Attest has a separate agent prove the change works in the running app, and turns that proof into an auditable record.

## What's strong

- **The problem is real and well framed.** "Generation is cheap, verification is scarce" is a good thesis, and the green-CI-but-broken-UI pain is easy to picture.
- **The positioning is the smartest part.** [COMPETITIVE_LANDSCAPE](COMPETITIVE_LANDSCAPE.md) admits that "we verify with computer-use" isn't new. The defensible thing is the **attestation itself**, not the act of verifying. That's the right call.
- **The docs are disciplined.** A "no unsourced claims" rule, an honest moat analysis, and a list of what would falsify the thesis. Few hackathon projects think this clearly.

## Strategic concerns

### 1. "Can't be faked by the model" isn't true yet, and it's the central claim

The event log is a plain JSONL file written by the same system being judged. Anyone, or any agent, could edit it. Evidence integrity sits under "Next" in the [ROADMAP](ROADMAP.md), but it's the foundation of the pitch.

**Suggestion:** chain each log entry to the previous one by hash and sign the final attestation. It's cheap and makes the claim defensible. Move it into hackathon scope.

### 2. The verifier only checks what the plan tells it to check

The flow the verifier drives comes from the planner's reading of the task. If the planner misreads the task, the verifier confidently confirms the wrong behaviour. The real source of trust is the human approval step.

**Suggestion:** write explicit acceptance criteria at plan time, have a person approve them, and map them one-to-one to verification steps in the record. The attestation then says "the approved criteria were checked and passed," which is much stronger than "an agent clicked around."

### 3. The verifier isn't independent of the producer

[VERIFICATION](VERIFICATION.md) says the verifier is the *same model family* as the producing agent. [STRATEGIC_OUTLOOK](STRATEGIC_OUTLOOK.md) calls independence the deepest problem and the best moat. Shared blind spots are exactly how a verifier gets fooled.

**Suggestion:** mix deterministic checks (DOM state, network responses, database rows) in with the vision-based checks.

### 4. SAM 3.1 is more demo flourish than verification

Segmentation shows a region *exists* on screen, not that the behaviour is *correct*. "The confirmation box is visible" is not "the order went through with the right total."

**Suggestion:** keep SAM in the loop, but don't let it decide the verdict.

### 5. The docs are far ahead of the code

There are about 60 KB of strategy docs and roughly 300 lines of mock code. Judges reward a run that actually works. The remaining hours belong in the code.

### 6. The chosen market doesn't match what's built

The [GTM_BRIEF](GTM_BRIEF.md) beachhead, proving a migration behaves like the original, is differential testing: same inputs to old and new systems, compare the outputs. What's built checks a single app ("does checkout work"). That's fine for a hackathon, but be ready to explain how the product gets from one to the other if a judge asks.

## Code vs. what the docs claim

| Issue | Where | Doc claim it contradicts |
|---|---|---|
| All evidence is hardcoded: every task reports `+40 -12`, the verifier always passes, plan approval is always `true`, the video path points to a file that doesn't exist | `src/orchestrator.ts`, `src/verifier.ts`, `src/harness.ts`, `src/attestation.ts` | [JUDGING_MAP](JUDGING_MAP.md): "End-to-end loop, not a mock" (the README correctly says it's a mock) |
| No retry or escalation: a failed verification ends in `rejected`; it doesn't reopen the task or move it to Wonder Full | `src/orchestrator.ts` | [AGENT_DESIGN §4–5](AGENT_DESIGN.md), [ARCHITECTURE](ARCHITECTURE.md) |
| Verification runs per task, not on the merged build | `src/orchestrator.ts` | [VERIFICATION](VERIFICATION.md) step 1 |
| `EventLog.flush()` runs only at the end, so a crash loses the whole log | `src/eventlog.ts`, `src/orchestrator.ts` | [EVENT_LOG_AND_REPLAY](EVENT_LOG_AND_REPLAY.md): "crash-safe" |
| The `attest` event is written after `buildAttestation`, so `traceEvents` leaves it out | `src/orchestrator.ts` | — |
| `parallelLimit` is never used, so there's no concurrency cap | `src/harness.ts` | [AGENT_DESIGN §2](AGENT_DESIGN.md) |
| The `counter` is module-level and carries over between runs | `src/harness.ts` | — |
| `SamUiConfirmer.confirm` returns `expected` unchanged, so it always confirms | `src/verifier.ts` | [VERIFICATION](VERIFICATION.md) pass/fail criteria |

## Docs and repo hygiene

- Broken links:
  - `CONTRIBUTING.md` is at the repo root but links `../README.md` and `adr/`.
  - `docs/MODEL_STRATEGY.md` links `../adr/…`, which should be `adr/…`.
- `docs/assets/` doesn't exist, so the README's `demo.gif` is missing.
- Every "Shipped" item in the [ROADMAP](ROADMAP.md) is unticked.
- [SUBMISSION](SUBMISSION.md) still has TODOs: repo link, track, tech stack, demo video.
- The project isn't a git repository yet.

## Recommended demo

Build one sequence that shows the whole argument:

1. A small real app; an agent "fixes" a bug.
2. **The agent's own tests pass.**
3. The Attest verifier catches the still-broken button; the task is rejected and reopened.
4. The retry passes.
5. End on a tamper-evident attestation: edit one line of the log live and show that verification fails.

That shows the problem, the gate, the retry loop and the artifact, which is everything the docs argue.

## Hackathon strategy (~20,000 participants)

With this many entries, judges can't look closely at everything. Expect a first screening round where each entry gets a minute or two: a glance at the video, the top of the README, maybe one link. Win that minute first.

### 1. Win the first 60 seconds

- **Video:** open with the key moment. The agent's tests go green, then Attest catches the broken button. No intro slides, no logo animation.
- **README:** the top screen holds the one-line pitch, a GIF of that moment, and one number (see §2). Push everything else lower.
- **Official rubric:** Impact 30% · Use of Meta AI tooling 25% · Demo 25% · Technical depth 20% (see [HACKATHON_RULES](../HACKATHON_RULES.md) and [JUDGING_MAP](JUDGING_MAP.md)). Use its wording in the submission.

### 2. Bring a number

The pitch rests on a borrowed stat (agents' tests catch fewer than 55% of logical mutants). Make a small version of your own:

- Take one small app and plant 10–20 bugs, or use mutation testing.
- Report what share the agent's own tests catch vs. what share Attest catches.
- Include Attest's false-pass rate. Showing where it fails builds trust.

"Agent tests caught 6 of 15, Attest caught 13 of 15" is the kind of line that gets remembered among thousands of agent wrappers.

### 3. Let judges check the proof themselves

- Publish a real evidence page from a real run.
- Hash-chain the attestation and include a one-line verify command. A judge can then edit one line of the log and watch verification fail.

### 4. Don't claim the obvious idea as the novelty

Meta staff already showed the code-writing agent + computer-use checker pattern, and many entries will copy it. The novelty is the **tamper-evident attestation** and the **plan-approved acceptance criteria**. Say that explicitly, once, early.

### 5. Make model-agnostic a point in Muse's favour

"We verify Claude and Codex output" can sound like selling a rival's agents at a Meta hackathon. Frame it as **"Built on Muse, Muse becomes the verifier for every agent."** Same neutrality, with Meta's stack at the centre of the trust layer. If there's time, a bonus clip of Attest verifying another agent's PR would land well.

### 6. Cut scope hard

- One app, one bug, one flow, real Muse calls. Leave out desktop apps, PDF and screen-recording input, and Muse Image.
- Keep the GTM and outlook thinking to one strong paragraph in the submission.
- Submit early. The rubric scores whether the demo **holds up live** (and the Nov 9 finals are live), so build for a reliable live run: the same small app, deterministic checks, a pre-warmed environment. Keep a recorded run only as a backup.

### 7. Small things that still matter

- **Name:** "Attest" is generic and likely used by at least one existing company. Make the repo and video titles distinctive so judges can find this project when they search.
- **Repo:** put it under git. A clean commit history shows real work.

### Priority order if time is short

1. A real run on one app
2. Hash chain plus the verify command
3. The benchmark number
4. The video
5. The README top screen

## Caveat

The Muse model, pricing and benchmark details were taken from this repo's docs and weren't checked independently.
