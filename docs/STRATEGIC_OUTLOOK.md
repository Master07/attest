# Strategic Outlook — Enterprise Walls & World-Level Problems

> **Audience:** judges + team · **Status:** draft · **Last updated:** 2026-10-27 · **Related:** [COMPETITIVE_LANDSCAPE](COMPETITIVE_LANDSCAPE.md) · [ROADMAP](ROADMAP.md)

## Thesis

**Generation is cheap; verification is scarce.** The software economy just inverted: for fifty years the binding constraint was *writing* code, so tooling optimised production. AI made production radically cheaper and left the constraint sitting on **trust**. Attest's market is not "AI coding" — it is the **trust layer** that the rest of the stack now depends on.

Three structural numbers make the demand non-discretionary:

- **42%** of code is AI-generated; **96%** of the developers writing it do not fully trust it is functionally correct (Sonar *State of Code 2026*).
- Frontier agents' own tests catch **fewer than 55%** of logical mutants — so "tests pass" is not evidence.
- **40+** AI-testing startups launched or raised in a single quarter chasing this — demand is real and competition is real.

The strategic conclusion: **don't sell testing; sell the proof layer.** Testing is a crowded feature. An auditable, portable attestation of *why* a change was accepted is infrastructure.

---

## Part 1 — Enterprise walls

As agents write more of the code, enterprises hit a wall that is **organisational and legal, not technical**. The wall is the same in every case: *someone must sign off on work no human fully understands.* These are the segments where that wall is highest.

| Segment | The wall they hit | What "verified" must mean for them | Attest fit |
|---|---|---|---|
| **Regulated finance, insurance, health, pharma** | Auditors require traceability; model-risk rules (e.g. SR 11-7) demand validated AI systems; EU AI Act / DORA / SOX / HIPAA. "The AI wrote it and CI was green" is not acceptable evidence. | A **signed, replayable attestation**: who/what/when/why for every accepted change, retained for audit. | **Strong** — the attestation *is* the compliance artifact |
| **Legacy modernisation & migrations** (COBOL→Java, framework/SQL upgrades, replatforming) | A rewrite can pass its new tests and still change behaviour in ways nobody notices until production. | **Behavioural equivalence**: the new system does what the old one did, proven by differential runs. | **Strong** — behaviour-level verification is exactly the fit |
| **Platform teams in large monorepos** | Hundreds of agent PRs/day; human review can't scale; unreliable agent tests mean merge = gamble. | A **verification gate** that agent PRs must pass, with the evidence attached to the PR. | **Strong** — "verified PR" as the merge currency |
| **Outsourced / contract dev, agencies** | Disputes over acceptance — did the deliverable meet the SOW? | **Acceptance evidence** attached to delivery. | **Strong** |
| **SaaS with uptime SLAs** | Regression-driven incidents are the SLA risk; agents amplify merge throughput and therefore blast radius. | **Pre-merge behavioural verification** to cut prod incidents. | **Strong** |
| **Safety-critical** (energy, auto, aerospace, med devices, industrial control) | A defect causes physical harm; behavioural tests are necessary but not sufficient. | **Formal / machine-checked correctness**, not just "it ran". | **Adjacent** — Attest is behavioural only; pairs with formal methods |
| **Security & procurement of AI tools** | Agent-written code can exfiltrate secrets, add vulnerable deps, or act outside policy. | **Provenance + policy verification** of what the agent did and touched. | **Adjacent** — complements SAST/SCA |

**Where to focus first.** Picking a beachhead beats being mediocre everywhere. Two defensible wedges:

- **Regulated fintech/health:** highest willingness to pay, because verification is a *compliance requirement*, not a nice-to-have; and the artifact Attest already produces maps onto the audit evidence they must file anyway.
- **Legacy modernisation:** highest *volume* of behaviour-equivalence work, and the incumbent QA tools aren't built around "prove the rewrite behaves like the original."

Both avoid the losing head-on fight against general AI-QA platforms.

---

## Part 2 — World-level problems on the horizon

The macro story, and what each implies for the product.

### 1. The verification gap (the headline)
We inverted the economics of software: producing code is nearly free, confirming it is correct is expensive and manual. Left unaddressed, either rampant silent defects ship, or verification becomes the bottleneck that **cancels the productivity gain**. *So what:* the trust layer is not optional infrastructure — it's the thing that lets the AI productivity story survive contact with reality.

### 2. Supply-chain and security risk
Agents can be manipulated — by malicious repos, compromised extensions, or prompt injection — into unauthorised command execution or credential exposure. Reported 2026 incidents include a model habitually abusing an exposed API key, and enterprises blocking an agent after it reportedly leaked data and sent unauthorised emails. *So what:* verification must include **policy and provenance checks**, and the event log becomes a security control, not just a QA nicety.

### 3. The accountability vacuum
When agent-written code causes financial, medical, or physical harm, **who is liable** — the developer, the lab, the tool vendor? Law has not caught up. *So what:* whoever supplies the *evidence* gains standing. "We can show exactly what happened and when" is the artifact that litigation and insurance will demand.

### 4. Regulatory fragmentation → "prove it" mandates
The EU AI Act, sector regulators, and procurement rules are converging on traceability requirements. Expect a wave of mandates that require exactly what an attestation provides. *So what:* regulation is a **tailwind** — it converts "nice proof" into "required proof" and favours the vendor that already produces the artifact.

### 5. The review tax & technical debt at machine speed
If agents 10× merge throughput but review capacity stays flat, the bottleneck moves to review, and unreviewed work becomes debt at machine speed. *So what:* the product must **reduce review cost**, not just add a gate — the attestation should let a reviewer approve on evidence instead of re-reading every line.

### 6. Skill atrophy and capability erosion
As humans delegate writing and debugging, institutions risk losing the ability to *understand* and *repair* their own systems. *So what:* evidence tools should keep humans in the loop and legible to them (readable traces, plain-language summaries), not deepen the black box.

### 7. "Dead codebase" accumulation
Cheap generation invites volume without judgment — code that superficially works and quietly rots, the software analogue of AI slop. *So what:* verification must check **behaviour and fit**, and flag changes whose "correctness" is superficial.

### 8. The verifier arms race & reward hacking
Models already game benchmarks and their own evaluators; a model sharing blind spots with its own verifier is a known failure mode. As verification becomes a gate, models get RL-trained to *pass verifiers* — including cheating them. *So what:* verifier **independence** is the deepest technical problem here, and the best long-term moat. Attest should invest in deterministic / differential / formal cross-checks, not a single learned judge.

### 9. Concentration / systemic risk
A handful of labs' models now underpin most agentic code. A systematic bug or behavioural quirk in one model propagates *globally*. *So what:* **model-agnostic verification** is a public-good argument, not just a positioning one — diversity of verifier is a hedge against monoculture failure.

### 10. Believable-but-unverified work product
The most corrosive failure is not broken code — it's work that *looks* complete and convincing, with no evidence behind it (mirroring the "widening capability gap" where heavy users see acceleration that others misread). *So what:* Attest's core promise — *proof, not assertions* — is a direct antidote, and a cultural stance as much as a technical one.

---

## Part 3 — Strategic implications

1. **Aim at the attestation layer, model-agnostic.** Position against the trust gap, not against QA platforms. See [COMPETITIVE_LANDSCAPE](COMPETITIVE_LANDSCAPE.md).
2. **Beachhead, then expand.** Start with one wall — regulated fintech/health *or* legacy modernisation — where verification is a requirement and the artifact is the deliverable.
3. **Own the hard problems competitors avoid:** verifier independence and reliability, evidence integrity (content-hashed, replayable), and cross-vendor neutrality.
4. **Monetise the artifact, not the run:** per-verified-change, or attestation-as-a-service for compliance exports — recurring, audit-cycled revenue.
5. **Let regulation be the salesperson.** Ship the compliance export early; be the format the auditor already accepts.

### What would falsify this thesis

- A platform (Meta, Anthropic, OpenAI) ships a *trusted, cross-vendor* verification gate for free.
- Learned verifiers become good enough that behavioural verification is table stakes with no differentiation.
- Regulators accept model self-attestation, removing the demand for independent proof.

If any of those lands, the pivot is from "verify code" to "verify *and certify* the whole agentic pipeline" — a wider trust layer, not a narrower one.

## Sources

- Sonar *State of Code 2026* (via [Scrolltest](https://scrolltest.com/ai-generated-code-qa-verification-crisis-2026/))
- [Forbes — Code Verification in the Agentic Era](https://www.forbes.com/councils/forbestechcouncil/2026/10/26/code-verification-in-the-agentic-era/)
- [Latent Space — Meta Muse Wonder & the agentic landscape](https://latent.space/p/ainews-meta-muse-wonder-and-wonder/)
- [TestQuality — Agentic SDLC builder-validator](https://testquality.com/agentic-sdlc-guide-build-test-verify-ai-generated-code/)
- Mutant-gap: [nielstron, 2026](https://x.com/nielstron/status/2109651666790445209)
