# Go-to-Market Brief

> **Audience:** team + judges · **Status:** draft · **Last updated:** 2026-11-01 · **Related:** [STRATEGIC_OUTLOOK](STRATEGIC_OUTLOOK.md) · [COMPETITIVE_LANDSCAPE](COMPETITIVE_LANDSCAPE.md) · [ADR 0005](adr/0005-narrow-to-proof-of-fix.md)

## The short version

**Users come from developers; revenue comes from compliance.** Attest gets adopted as a free proof-of-fix check on pull requests (open-source maintainers, small teams), and earns money where a signed record of *why a change was accepted* is worth paying for: agent platforms, regulated companies, and migrations.

Not "AI QA." Not "test generation." The product is the **receipt**: a signed, checkable proof that a change fixes what it claims, in the running app.

## Unit economics

Measured on the hackathon build (see HANDOVER.md §9): the first three single-phase live runs plus one full proof cost **$0.12** of Meta Model API credits in total, about 2 cents per verifier phase. A full proof adds SAM 3.1 and a judge call per phase; confirm the exact figure from the billing page after the benchmark run before quoting it.

The AI is not the expensive part. The real cost of a proof is **running the customer's app** (a worktree, a build, a browser) — compute and setup, not tokens. Pricing should be per proof or per repo, well above that cost; the margin comes from the evidence, not the compute.

## Four revenue paths

| # | Path | Who pays | Model | Why it might work | Why it might not |
|---|---|---|---|---|---|
| 1 | **GitHub app** | Free for public repos; small teams for private repos | Per repo or per proof | Fastest route to users and visibility; maintainers are drowning in AI-written PRs | Small teams pay little; the free tier must not eat the business |
| 2 | **API / CI check for agent platforms** | Companies whose agents open PRs | Usage-based, sold to the platform | "Every agent PR arrives with a receipt" — one platform deal is a lot of volume | The platform can build its own; neutrality across vendors is the counter |
| 3 | **Compliance receipts** | Regulated teams (finance, health, critical infrastructure) | Annual contract; receipts retained as audit evidence | Highest willingness to pay; regulation (SOX / DORA / EU AI Act / SR 11-7) turns "nice proof" into "required proof" | Slow sales; needs security review, data-handling guarantees, receipts anchored publicly, and auditor acceptance |
| 4 | **Legacy migrations** | Teams and consultancies replatforming systems | Per-project licence, using the equivalence proof mode | Budgets already exist inside migration projects; the receipt is the sign-off artifact | Starts service-heavy; every migration's setup is different |

**Read:** path 1 earns adoption and trust in the receipt format; paths 3 and 4 earn revenue; path 2 is the big upside if a platform partners. The sequence below follows that.

## The job to be done

> *"Prove this change fixes the problem and breaks nothing — in the running app — with evidence I can show someone."*

Felt by: maintainers reviewing agent PRs; platform teams merging many of them; anyone who has to sign off on a change they didn't write.

## Buyer & stakeholders (paths 3 and 4)

| Role | Who | What convinces them |
|---|---|---|
| **Economic buyer** | CTO / CIO / VP Eng | Lower change risk, faster sign-off, an audit trail |
| **Champion** | Staff engineer, QA or release lead | Less manual verification; evidence they can point to |
| **Blocker** | Security / procurement | Where code, data and screenshots are processed; self-hosting option |
| **Influencer** | Internal audit / compliance | A retained, verifiable record — does an auditor accept it? |

**Budget source:** the migration or compliance programme, not the dev-tools line.

## Positioning statement

> **Attest is proof-of-fix for AI pull requests: a verifier that never sees the code reproduces the bug, confirms the fix in the running app, proves it would catch a wrong fix, and seals it all into a receipt anyone can check.**

Deliberately model-agnostic: it verifies changes from Muse Code, other agents, or people. That makes competing agents into inputs, and is the one thing a single-vendor platform structurally won't do.

## Pricing (hypotheses to test, not decisions)

| Tier | Model | Who |
|---|---|---|
| **Open source** | Free for public repos, with a monthly proof cap | Maintainers |
| **Team** | Per private repo per month, proofs included | Small teams |
| **Platform** | Per proof, volume-tiered | Agent platforms, large engineering orgs |
| **Assurance** | Annual: retained receipts, compliance export, self-hosted verifier | Regulated customers |

Monetise the **receipt**, not the compute.

## What's defensible

- **Not** "we verify with computer use" — a feature many will copy, and one Meta teaches in its own sessions.
- **The receipt as a standard:** an open, signed, checkable format that any agent or CI system can produce and any auditor can check. An accepted standard is hard to displace.
- **Measured trustworthiness:** a published false-pass rate, and a verifier that says INCONCLUSIVE rather than guessing.
- **Neutrality:** verifying every vendor's agent output.

## Risks

| Risk | Response |
|---|---|
| A platform (GitHub, Meta, Anthropic, OpenAI) ships a built-in "verify before merge" | Stay cross-vendor; own the receipt format, not the agent |
| Setting up each customer's app is the real friction | Start with web apps that already have a dev server; a config file (`attest.yml`) per repo; templates for common stacks |
| A public false pass destroys trust | Measure and publish the false-pass rate; never certify on incomplete evidence |
| Crowded AI-testing market (see COMPETITIVE_LANDSCAPE) | Sell proof and audit evidence, not test generation |
| Screenshots may contain customer data | Self-hosted verifier for regulated customers; no data leaves their environment |

## Validation plan (after the hackathon)

1. **Weeks 1–2:** show the demo and a receipt to ~10 open-source maintainers and ~5 teams using coding agents. Ask: would you install it? What would make you trust the receipt? What would you pay for?
2. **Weeks 3–6, if there's pull:** a hosted GitHub app with a free tier for public repos; measure proofs per week and false-pass rate.
3. **In parallel, if a regulated team is interested:** one design partner for the compliance track; the goal is a real auditor accepting a receipt.
4. **Publish the receipt schema** once the format is stable, so others can produce and check receipts.

## Metrics that matter

- **Proofs per week** — adoption.
- **False-pass rate** — changes that got `PROVEN` and still broke. Must trend to zero, and be public.
- **Time to approve a PR** — does Attest reduce review time, or add to it?
- **Auditor acceptance** — did a real auditor accept a receipt?
- **Conversion** — free → team → platform / assurance.

## What we deliberately do NOT do

- Head-on general AI QA or test generation.
- Formal verification (a different technology; partner with it).
- Any single-vendor lock-in (it would kill the neutrality that is the moat).
- Claims we can't measure: no false-pass or revenue numbers until they exist.
