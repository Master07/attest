# Model Strategy

> **Audience:** devs + judges · **Status:** current · **Last updated:** 2026-11-01 · **Related:** [ARCHITECTURE](ARCHITECTURE.md) · [reference/muse-models](reference/muse-models.md)

Every model Attest calls at runtime is a Meta model. Each one has a separate job, and the jobs are chosen so that no single model can pass a fix on its own: the verifier acts, and the other voters check what it saw.

## Who does what

| Job | Model | Provider | Where in code | Why this model |
|---|---|---|---|---|
| **Verifier** — drives the running app with computer use, blind to the code | Muse Spark 1.3 (`muse-spark-1.3`) | Meta Model API | `src/cua.ts` | The Responses API `computer` tool works on Spark 1.3; Muse Wonder returns `400 Unsupported tool type` |
| **Element check** — is the target visible, and did the click reach it? | SAM 3.1 (`sam-3.1`) | Meta Model API | `src/sam.ts` | Segments what is actually on screen; combined with click hit-testing it shows covered buttons |
| **Independent judge** — votes from the criteria and the screenshot sequence only | **Muse Spark Open** (`meta-models/muse-spark-open`), open weights | **Baseten** (own account) | `src/judge.ts` | A different model from the verifier, so one model's blind spot can't pass a fix; open weights keep this vote outside the closed API. Falls back to Muse Wonder (`muse-wonder-1.0`) when no Baseten key is set |
| **Bug intake** — narration to text | Muse Voice Transcribe (`muse-voice-transcribe-1.0`) | Meta Model API | `src/intake.ts` | Speech-to-text for `attest draft` |
| **Bug intake** — screen recording + transcript to draft criteria | Muse Spark 1.3 | Meta Model API | `src/intake.ts` | Accepts video input |
| **Producer** — writes fixes in `attest loop` | Muse Code (Spark 1.3) | Muse Code CLI, headless | `src/producer.ts` | Attest proves or rejects whatever it writes |

## Open weights: provenance

The judge runs on **Muse Spark Open**, Meta's open-weights model, served by Baseten from the maintainer's **own Baseten account** (not hackathon partner credits). Meta organizers confirmed in the hackathon Discord that Spark Open through your own Baseten account counts as an open-weights model.

- Receipts name the judge model and provider (`judge: baseten/meta-models/muse-spark-open`), so every proof shows which model voted.
- The committed cassettes (`examples/checkout-demo/`, `examples/checkout-widget/`, `examples/realworld/board-enter/` — each `cassette.jsonl`) were recorded from live runs with Spark Open judging; replays use it automatically and need no key. Each live receipt in `proofs/pr-1-live` and `proofs/realworld/` keeps the judge's verbatim vote and reason per phase.
- Spark Open is called through Baseten's OpenAI-compatible **Responses API** with screenshots as `input_image` — the same request the Wonder fallback uses, so no code differs between them.
- The ID `meta-models/muse-spark-open-1026` from the hackathon FAQ is for the hackathon key; own accounts serve `meta-models/muse-spark-open` (check `GET https://inference.baseten.co/v1/models`).

## Routing in code

Each role maps to a provider (`meta` = Meta Model API, `baseten` = Meta open-weights models on Baseten) and a model in `src/models.ts`:

| Role | Route | Note |
|---|---|---|
| `verifier` | `meta:muse-spark-1.3` | Must be Spark (computer tool) |
| `ui` | `meta:sam-3.1` | Prefers short concepts ("button" works where "Pay button" returns nothing), so Attest falls back to the head noun |
| `judge` | `baseten:meta-models/muse-spark-open` when `BASETEN_API_KEY` is set or a cassette replays; otherwise `meta:muse-wonder-1.0` | |
| `worker`, `reasoning`, `image` | Spark 1.3, Wonder, Muse Image | Defined for the roadmap; not called by the proof today |

Override any role without code changes: `ATTEST_ROUTE_<ROLE>=provider:model`. Keys and endpoints come from environment variables; see `.env.example`.

## Cost controls

- A step cap on the verifier loop and `truncation: "auto"` keep long runs bounded.
- The judge sees at most 8 sampled frames.
- Replay mode (`--replay`) re-runs a recorded proof with no API calls — for development, demos and anyone without a key.

## See also

- [ADR 0004](adr/0004-model-tier-routing.md) — the original tier-routing decision
- [reference/muse-models](reference/muse-models.md) — full model matrix and benchmarks
