# Roadmap

> **Audience:** judges · **Status:** draft · **Last updated:** 2026-10-31 · **Related:** [ARCHITECTURE §14–15](ARCHITECTURE.md) · [ADR 0005](adr/0005-narrow-to-proof-of-fix.md)

Items are tagged by how real they are: **Build** (real, demoed), **Show** (thin but real, run once), **Tell** (roadmap only). Boxes are ticked only when the item runs against the real Meta API.

## Hackathon — Build (by Nov 4)

**Gate:** nothing below the line starts until the core runs end to end on the real Spark API.

- [x] Example apps with `base`, `bad-fix` and `fix` branches (two demos)
- [x] Blind CUA verifier on Muse Spark 1.3 (Responses API `computer` tool), with stateless-replay fallback
- [x] Fix proof: Red / Green / Break with deterministic checks
- [x] Hash-chained event log, signed receipt, `attest verify`
- [x] Replay mode so judges can run without API keys

---

- [x] Closed loop: Muse Code retries on `REJECTED` until `PROVEN` or the retry limit (built; Muse Code has fixed every demo bug on the first attempt so far)
- [x] Benchmark: 10 planted UI bugs; agent tests vs. Attest, misses included ([BENCHMARK](BENCHMARK.md))
- [x] Proof videos per phase + SAM 3.1 visibility check with click hit-testing and reveal images
- [x] Independent judge (Muse Wonder); [ ] move it to Muse Spark Open via Baseten for open weights
- [x] Real-world proof: TodoMVC's 2012 delete bug ([examples/realworld](../examples/realworld/todomvc-delete/README.md))

## Hackathon — Show (only if time remains)

- [ ] Regression mode: re-run previously proven criteria on a new PR
- [ ] Equivalence mode: old and new builds agree on every criterion
- [ ] Receipt summary posted as a PR comment via `gh`
- [ ] Published receipt JSON schema + standalone `attest verify`

## Stretch

- [x] Criteria drafted from a voice + screen-recording bug report (Muse Voice Transcribe + Spark video input) — `attest draft`
- [ ] Recording-vs-reality mismatch check
- [ ] Auto-generated Break mutants

## After the hackathon — Tell

- **Intermittent bugs** — repeat runs with counts and varied conditions ([ARCHITECTURE §13](ARCHITECTURE.md))
- **Desktop apps** — extend the verifier beyond the browser
- **Production-only bugs** — evidence captured when they happen
- **Transparency log** — publicly anchor receipts so signatures can be audited
- **CI integration** — `attest prove` as a required check; GitHub Marketplace app
- **Compliance export** — receipts as audit evidence for regulated teams
- **Orchestration** — plan, fan-out and merge from the original design
- **Pricing** — per-proven-change, or receipts-as-a-service

## Non-goals

- Replacing human review — Attest gives reviewers evidence; humans still own the merge decision.
- Deepfake or general fake-media detection — Attest certifies only what it can reproduce ([ARCHITECTURE §13](ARCHITECTURE.md)).
- Being a general chat assistant.
