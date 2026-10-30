# Model Strategy

> **Audience:** devs + judges · **Status:** draft · **Last updated:** 2026-11-01 · **Related:** [AGENT_DESIGN](AGENT_DESIGN.md) · [COST](COST.md) · [reference/muse-models](reference/muse-models.md)

Attest's quality-per-dollar comes from routing each role to the cheapest Muse model that can do the job. See the [ADR](../adr/0004-model-tier-routing.md).

## Role → model

| Role in Attest | Model | Model ID | Why |
|---|---|---|---|
| Parallel workers, tight tool loops | Muse Spark 1.3 | `muse-spark-1.3` | Fast, cheap, strong agentic coding; the default |
| Same, budget-sensitive runs | Spark 1.3 Contributor | `muse-spark-1.3-contributor` | ~12× cheaper input, ~21× cheaper output |
| Merge / conflict resolution, architecture, hard bugs | Muse Wonder Full | *(picker only)* | Deepest reasoning; Power/Maximum plan only |
| Optional mid-tier reasoning | Muse Wonder | `muse-wonder-1.0` | Frontier on every plan; preview |
| App assets / evidence imagery | Muse Image | `muse-image-1.0` | Generation + editing |
| UI element confirmation | SAM 3.1 | `sam-3.1` | Segment what's actually on screen |
| Voice intake (stretch) | Muse Voice Transcribe | `muse-voice-transcribe-1.0` | Speech-to-text |

## Switching models

```text
/model                       # open the picker
/model muse-wonder-1.0       # since CLI 1.4.5
```

Muse Wonder Full has **no public model ID** — select it from the picker (Power/Maximum plans only).

## Providers and routing in code

Each role routes to a **provider** (`meta` = Meta Model API, `baseten` = Meta open-weights models on Baseten) and a model. Defaults live in `ROLE_ROUTE` in `src/models.ts`:

| Role | Default route | Note |
|---|---|---|
| `worker` | `meta:muse-spark-1.3` | `ATTEST_CONTRIBUTOR=1` switches to the Contributor tier |
| `reasoning` | `meta:muse-wonder-1.0` | Wonder Full has no API ID, so the API route uses Wonder |
| `image` | `meta:muse-image-1.0` | |
| `ui` | `meta:sam-3.1` | Locates `expect.visible` elements; prefers short concepts ("button" works where "Pay button" returns nothing), so Attest falls back to the head noun |
| `verifier` | `meta:muse-spark-1.3` | Drives the computer-use loop. Must be Spark: Wonder rejects the `computer` tool on the Model API |
| `judge` | `meta:muse-wonder-1.0` | Independent vote from criteria + before/after screenshots only. With a Baseten key, `ATTEST_ROUTE_JUDGE=baseten:meta-models/muse-spark-open-1026` moves it to open weights |

Override any role without code changes: `ATTEST_ROUTE_<ROLE>=provider:model`, e.g. `ATTEST_ROUTE_WORKER=baseten:meta-models/muse-spark-open-1026` to move the fan-out onto Baseten credits. Keys and endpoints come from env vars; see `.env.example`.

From the hackathon Discord (see [DISCORD_NOTES](DISCORD_NOTES.md)):

- `meta-models/muse-spark-open-1026` is the official Baseten model ID, and the hackathon Baseten key **only** serves Muse Spark Open — Glimmer is not available there.
- Computer use (Responses API, `tools: [{"type": "computer"}]`) works on `muse-spark-1.3` and returns `400 Unsupported tool type` on `muse-wonder-1.0`.
- The Baseten base URL in `src/models.ts` (`https://inference.baseten.co/v1`) is unconfirmed; use the one in Baseten's instructions email via `BASETEN_BASE_URL`.

## Contributor vs Standard

- **Contributor mode** is on by default for subscribers: more usage in exchange for Meta training on your content. Toggle in `/settings`.
- On the API, the split is by model ID (`-contributor` suffix = cheaper, data may be used for training).
- For a public hackathon repo, Contributor mode is fine; for client/proprietary code, use Standard.

## Rules of thumb

1. Default everything to **Spark 1.3**. Escalate only on the events in [AGENT_DESIGN §4](AGENT_DESIGN.md).
2. Never run the whole fan-out on **Wonder Full** — it is the cost cliff.
3. Use `/effort` to dial reasoning down on straightforward tasks (thinking tokens bill as output).
4. Keep `muse-spark-1.2` handy only if **audio** quality on 1.3 degrades.

## Why this is a demo, not just config

The tier switch is visible in the demo: six workers spin up on Spark in parallel, then a merge conflict escalates to Wonder Full live. It shows the *right* way to spend on agents — cheap by default, expensive where it matters.

## See also

- [reference/muse-models](reference/muse-models.md) — full model matrix and benchmarks
- [COST](COST.md) — what this routing actually costs
