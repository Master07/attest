# Brainstorm

> **Audience:** team · **Status:** draft · **Last updated:** 2026-10-28 · **Related:** [FEEDBACK](FEEDBACK.md) · [DEMO_SCRIPT](DEMO_SCRIPT.md) · [ROADMAP](ROADMAP.md)

Ideas across features, demo, alternatives, and branding. ⭐ marks the top picks.

> **Adopted (2026-10-30):** Attest is now **proof-of-fix for AI pull requests** — Red/Green/Break, a blind verifier, a tamper-evident receipt, any agent's PR, and maintainers as the impact story. Fan-out and orchestration are out of hackathon scope. See [ADR 0005](adr/0005-narrow-to-proof-of-fix.md). The ideas below are kept for reference; ⭐ items 1–4 and the demo picks are folded into the adopted version.

## 1. Attest features

| # | Idea | Why it matters |
|---|---|---|
| ⭐ 1 | **Verifier self-test.** On every run, plant a bug (a mutant) in a copy of the change and check that the verifier catches it. The attestation reports how sensitive the verifier was. | Answers "who verifies the verifier?", the open problem in [STRATEGIC_OUTLOOK](STRATEGIC_OUTLOOK.md). |
| ⭐ 2 | **Differential mode.** Run the same flow on the base branch and the PR branch; compare screenshots, DOM, and network calls. | Proves the change did what it claimed and broke nothing else. Bridges to the migration market in [GTM_BRIEF](GTM_BRIEF.md). |
| ⭐ 3 | **Acceptance-criteria contract.** The plan produces Given/When/Then criteria, a person approves them, and each maps to a verification step and its evidence. | The attestation becomes a checklist a reviewer can approve without re-reading the code. |
| 4 | **Tamper-evident record + `attest verify`.** Hash-chain the log and sign the attestation. | Turns "can't be faked" into something a judge can check. |
| 5 | **Adversarial verifier.** After the happy path passes, deliberately try to break the feature: empty inputs, double clicks, the back button. | Catches what happy-path checks miss. |
| 6 | **Verifier diversity.** Run a vision-based check and a deterministic Playwright check side by side; flag disagreement. | Partial answer to the independence problem. |
| 7 | **`attest verify <PR-url>`** for a PR written by any agent. | Makes model-agnostic concrete. |
| 8 | **Verified flows become regression tests**, re-run on future merges. | Value builds up over time. |
| 9 | **PR comment / GitHub check** with the criteria checklist, a clip, and the hash. | Puts evidence where reviewers already work. |

## 2. Demo concepts

| Concept | The moment it creates |
|---|---|
| ⭐ **"The invisible button."** A cookie banner or overlay covers the Pay button. Unit tests pass because the handler works; a real user can't click it. | Visual and instant; exactly the bug class only driving the real app catches. |
| ⭐ **Split screen.** Left: the agent says "Done ✅, 12/12 tests pass." Right: Attest says "Rejected," with a clip of the failed click. | One frame tells the whole story; perfect thumbnail and opening shot. |
| ⭐ **Live tamper.** Edit one line of the log, re-run `attest verify`, watch it fail. | Proves the evidence can't quietly be changed. |
| **Wrong total.** A discount is applied twice; the unit test checks the function in isolation, the screen shows the wrong amount. | Behaviour checks beat isolated unit tests. |
| **"We broke it on purpose."** Show the verifier self-test catching a planted bug. | Demonstrates the most novel feature. |
| **Bug from a screen recording.** The work item is a 10-second clip of the bug. | Shows off multimodal input. |

**Suggested combination:** open on the split screen → invisible-button bug → retry passes → end on the live tamper.

## 3. Alternative project ideas (same Muse stack)

| Idea | Note |
|---|---|
| **Bug from video.** Reproduce a recorded bug with computer-use, write a failing test, fix, prove. | Fold into Attest as an intake mode. |
| **Accessibility fixer.** Computer-use navigates by keyboard, SAM finds unlabeled controls, the agent fixes and proves. | Clear social impact. |
| **Design fidelity.** Build from a design PDF; SAM compares the rendered UI to it, looping until they match. | Very visual demo. |
| **Migration twin.** Run old and new systems side by side; compare behaviour. | The GTM wedge; overlaps with differential mode. |
| **Agent flight recorder.** Security/provenance analytics over any agent's event log: files touched, secrets accessed, commands run. | Different buyer (security). |
| **Incident replayer.** Rebuild a production bug from logs or a session replay, then fix and verify. | Useful but setup-heavy. |

**Take:** don't pivot. Attest is the strongest of these, and the best alternatives fit inside it (bug from video as intake, migration twin as differential mode).

## 4. Name and branding

### Names

| Name | Feel |
|---|---|
| ⭐ **Countersign** | The agent signs, Attest countersigns. Fits the attestation story exactly. |
| **Receipts** | Fun and memorable: "show me the receipts." |
| **Eyewitness** | Verifying by actually watching the app. |
| **Vouch** / **Notary** / **Sealed** | Trust and certification; more enterprise-friendly. |

None of these have been checked for existing companies or trademarks. Search before committing.

### Taglines

- "The agent says done. We say show me."
- "Done means demonstrated."
- "Don't trust the agent. Check the receipt."
- "Every PR ships with proof." (current, still strong)

### Pitch framing

"Built on Muse, Muse becomes the verifier for every agent."
