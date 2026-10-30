# Competitive Landscape

> **Audience:** judges + team · **Status:** draft · **Last updated:** 2026-10-27 · **Related:** [STRATEGIC_OUTLOOK](STRATEGIC_OUTLOOK.md) · [JUDGING_MAP](JUDGING_MAP.md)

## The honest framing

Verification of agent-generated code is **not greenfield** — it is a funded, crowded category. 40+ startups launched or raised for AI-powered testing in Q1 2026 alone, and the "agentic SDLC" literature now names *builder-validator verification* as the standing fix for multi-agent failure. The competitive question is therefore not *"is there a gap?"* but *"which gap is defensible, and where are we structurally weaker than incumbents?"*

## Tier 1 — Direct: autonomous behavioural verification

These already run the application and check it works. This is Attest's exact job.

| Player | What they do | Overlap |
|---|---|---|
| Momentic, QA Wolf, Ranger, Spur, Expect | Autonomous browser E2E; explicitly grouped as tools that *verify coding-agent output* | **Very high** — same pitch, years of head start, enterprise logos |
| mabl, Applitools, Autify, Testsigma, Functionize, TestMu | Full AI QA platforms: test generation, visual regression, autonomous execution | High — broader suite, deep enterprise trust |

**Read:** this is where a head-on "we do AI QA" pitch loses. They have Gartner coverage and procurement relationships.

## Tier 2 — Adjacent: static review gates

**CodeRabbit · Greptile · Qodo · GitHub Copilot code review · Cursor Bugbot · Graphite Diamond · Sonar AI · Macroscope · DeepSource**

They block merges on static signals — the diff, a codebase graph, SAST rules. They **do not verify behaviour**. This is the seam: they review *the change*; Attest verifies *that the app works*.

## Tier 3 — Platform risk: your feature is their product

| Platform | Why it's a threat |
|---|---|
| **Muse Code (Meta)** | Already ships computer-use, multi-agent fan-out, and a replayable event log. A "verify before done" gate is a thin feature away. Meta staff publicly demoed the *generation-agent + CUA-verifier* pattern. |
| Claude Code, OpenAI Codex, Cursor, Grok Build, OpenCode 2.0 | Any can add a verification loop and reach millions of existing users overnight. |

## Tier 4 — The hard-verification camp

- **Formal verification / vericoding** — machine-checked correctness; the strongest possible claim, and the honest "more rigorous than us" alternative.
- **Mutation testing** (Stryker, PIT) — the technique behind our own `<55%` framing; mature and open-source.
- **Learned verifier models / test-time scaling** — active research (e.g. SafeCUA, generative reward models). If a *learned* verifier ships, computer-use verification becomes table stakes.

## Tier 5 — Inside the hackathon

Other participants. Many will build agent wrappers; the ones who copy verification will copy the CUA-verifier pattern Meta already demoed — so "we verify with computer-use" alone is **not novel to judges**. Novelty must come from the *attestation*, not the act of verifying.

---

## Positioning: be the attestation layer, not "AI QA"

> **Attest is the attestation layer for agent-written code — model-agnostic verification that turns any coding agent's output into a change you can *prove* works, packaged as an auditable artifact.**

Three moves this positioning makes:

1. **Flips competitors into inputs.** If Attest verifies output from Claude Code, Codex, Cursor *and* Muse Code, Tier 1/2 stop being rivals and become sources of changes to verify.
2. **Side-steps the platform risk partially.** Cross-vendor neutrality is the one thing Meta's own stack structurally *won't* do.
3. **Moves the fight from features to evidence.** We don't argue our verifier is smarter; we argue our *record* is auditable and theirs isn't.

## Why we win / where we're exposed

| Dimension | Attest | Tier 1 incumbents | Tier 2 reviewers |
|---|---|---|---|
| Behaviour-level proof | ✅ | ✅ | ❌ (static) |
| Tamper-evident evidence (**edits after capture are detectable**) | ✅ | ⚠️ usually report-only | ⚠️ comment-only |
| Model-agnostic (verifies any agent's output) | ✅ | ⚠️ vary | ⚠️ some |
| Enterprise trust / logos / Gartner | ❌ | ✅ | ✅ |
| Feature breadth | ❌ | ✅ | ✅ |
| Who verifies the verifier? | ⚠️ open problem | ⚠️ | n/a |

## The moat question

Ask what is actually defensible over ~18 months:

- **Thin moat:** "we use computer-use to verify" — one feature-sprint away for any Tier 1 or Tier 3 player.
- **Thicker moat:** the **attestation artifact** — its format, its *evidence-integrity* guarantees (content-hashed, replayable), cross-vendor neutrality, and compliance integrations (SOX / DORA / EU AI Act / SR 11-7). Regulation is a tailwind: it turns "nice proof" into "required proof."
- **Hardest problem to own, and the best moat:** verifier *independence and reliability* — see [STRATEGIC_OUTLOOK §Verifier arms race](STRATEGIC_OUTLOOK.md).

## Source caveat

Several third-party ranking sites are SEO aggregators. The **category** is well-corroborated (Forbes, Ryan Walker's research); specific tool rankings and scores are **not** — treat them as directional.

## Sources

- [Forbes — Code Verification in the Agentic Era](https://www.forbes.com/councils/forbestechcouncil/2026/10/26/code-verification-in-the-agentic-era/)
- [Ryan Walker Research — AI QA Agents](https://rywalker.com/research/ai-qa-agents)
- [Scrolltest — 40+ AI testing startups, agentic epoch](https://scrolltest.com/ai-testing-startups-agentic-epoch-qa-survival-map-2026/)
- [TestQuality — Agentic SDLC: builder-validator verification](https://testquality.com/agentic-sdlc-guide-build-test-verify-ai-generated-code/)
- [Macroscope — AI code review tools 2026](https://macroscope.com/content/best-ai-code-review-tools-github-2026)
- [Scrolltest — 42% AI-generated code / trust crisis](https://scrolltest.com/ai-generated-code-qa-verification-crisis-2026/)
