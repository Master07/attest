# Go-to-Market Brief

> **Audience:** team + judges · **Status:** draft · **Last updated:** 2026-10-27 · **Related:** [STRATEGIC_OUTLOOK](STRATEGIC_OUTLOOK.md) · [COMPETITIVE_LANDSCAPE](COMPETITIVE_LANDSCAPE.md)

## The pick

**Beachhead: behaviour-equivalence verification for enterprise legacy modernisation.**

Not "AI QA." Not "test generation." The wedge is the one job that is *high volume, high stakes, and structurally underserved*: **proving that a rewritten, upgraded, or replatformed system still behaves like the original.**

Why not general AI QA: that fight is a head-on collision with funded incumbents (Momentic, QA Wolf, mabl) who hold enterprise logos and Gartner coverage. See [COMPETITIVE_LANDSCAPE](COMPETITIVE_LANDSCAPE.md). Why not formal verification: it's a different, harder technology — partner with it, don't compete.

Why modernisation wins as the entry point:
- **Enormous, funded volume.** Framework/SQL/cloud migrations and monolith→services work are large, risky, and already budgeted.
- **The incumbent QA tools aren't shaped for it.** They generate and run tests; they don't prove *equivalence to a prior system*.
- **The artifact is the deliverable.** Differential evidence — same inputs, old vs new, agrees — is exactly what the customer needs to sign off.
- **It expands upward into compliance** once the artifact is trusted (see expansion below).

## The job to be done

> *"Prove this change preserves behaviour — before it reaches production, with evidence I can show someone."*

Felt most acutely by teams mid-migration, where a passing new test suite can still hide a changed behaviour that only surfaces in production.

## Buyer & stakeholders

| Role | Who | What convinces them |
|---|---|---|
| **Economic buyer** | CTO / CIO / VP Eng owning the migration | Lower migration risk, faster sign-off, fewer prod incidents |
| **Champion** | Staff/Principal engineer, QA lead on the migration | Cuts their manual verification toil; credible to their peers |
| **Blocker** | Security / procurement | Where code and data are processed; data-handling posture |
| **Influencer** | Internal audit / compliance | A retained, replayable record (the future expansion path) |

**Budget source:** the migration project — not a tools line. This matters: it moves Attest out of the "small dev-tool budget" fight.

## The wedge → expansion

1. **Land:** Attest as the **change gate** on the migration — every change ships with a behavioural attestation.
2. **Expand within the account:** from per-PR gate to **release gate** across the migration programme.
3. **Expand into compliance:** the same artifact becomes **audit evidence** (SOX / DORA / EU AI Act / SR 11-7), sold as attestation-as-a-service to the regulated customer.

The wedge is one migration. The expansion is the trust layer for the whole enterprise.

## Positioning statement

> **Attest is the attestation layer for agent-written code — model-agnostic verification that turns any coding agent's output into a change you can *prove* works, packaged as an auditable artifact.**

Deliberately model-agnostic: it verifies output from Claude Code, Codex, Cursor *and* Muse Code. That turns competitors into inputs and is the one thing a single-vendor platform structurally won't do.

## Pricing

| Tier | Model | Who |
|---|---|---|
| **Pilot** | Per-verified-change, capped | One migration team proving the loop |
| **Programme** | Per-migration licence | Platform org running many agent PRs |
| **Attestation-as-a-service** | Retained, audit-cycled subscription | Regulated customer needing evidence over time |
| **Compliance export** | Add-on | Internal audit / external regulators |

Monetise the **artifact**, not the compute. Verification runs are a cost to pass through; the evidence is the recurring product.

## First 90 days

- **Phase 0 — one design partner.** A single team mid-migration; instrument Attest on their real changes.
- **Phase 1 — prove the loop.** Ship the change gate + attestation; measure false-pass rate against their incidents.
- **Phase 2 — publish the format.** Open the attestation schema so it becomes the thing auditors and tools reference.
- **Phase 3 — the compliance export.** Ship the auditable report; use it to open the regulated expansion.

## Metrics that matter

- **Verified changes / week** — adoption.
- **False-pass rate** — changes that passed Attest and still broke (the honesty metric; must trend to zero).
- **Time-to-approve** — did we *reduce* the review tax, not add to it?
- **Audit acceptance** — did a real auditor accept the artifact?
- **Expansion revenue** — pilot → programme → service.

## Risks & moat

| Risk | Response |
|---|---|
| Platform absorption (Meta/Anthropic ship a verify gate) | Be cross-vendor; own the artifact, not the agent |
| Verifier unreliability (false passes) | Invest in verifier independence; publish false-pass rate |
| "AI QA" commoditisation | Stay in behaviour-equivalence + compliance, not generic QA |
| Trust in a new vendor | Design partner + open format + external audit acceptance |

**The moat is the artifact:** its format, its evidence-integrity guarantees, cross-vendor neutrality, and regulatory acceptance. Features are copyable; an accepted standard is not.

## What we deliberately do NOT do

- Head-on general AI QA (lose to incumbents).
- Formal verification (partner; it's a different technology).
- Any single-vendor lock-in (kills the neutrality that is the moat).
