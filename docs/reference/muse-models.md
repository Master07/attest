# Muse Model Reference

> **Audience:** devs + judges · **Status:** draft · **Last updated:** 2026-10-27 · **Related:** [MODEL_STRATEGY](../MODEL_STRATEGY.md)

The full Meta Muse lineup, with the numbers Attest's routing depends on. Vendor (Meta) benchmark figures are directional; third-party figures are labelled.

## Models you can run in Muse Code

All have a **1,048,576-token** context window and text output.

| Model | Model ID | Input | Reasoning | Available on | Best for |
|---|---|---|---|---|---|
| **Muse Wonder Full** | *(picker only)* | text·image·video·audio·PDF | max | Power $50 / Max $200 | Hardest multi-file, multi-hour runs |
| **Muse Wonder** (preview) | `muse-wonder-1.0` | text·image·video·audio·PDF | minimal→max | every plan + API | Frontier work on any plan |
| **Muse Spark 1.3** (default) | `muse-spark-1.3` | text·image·video·audio*·PDF | minimal→max | every plan + API | Default daily driver |
| **Spark 1.3 Contributor** | `muse-spark-1.3-contributor` | as above | up to high | every plan + API | Cost-sensitive, parallelizable work |
| **Spark 1.2** (+ contributor) | `muse-spark-1.2` | full multimodal | all | every plan + API | Fallback when 1.3 audio degrades |

\* Audio on Spark 1.3 is not fully supported — use Spark 1.2 or Muse Voice Transcribe.
Muse Spark 1.1 exists on the API only and is **not** in Muse Code.

## Full Meta catalog

| Line | Model ID | Input → Output | Where |
|---|---|---|---|
| Muse Wonder | `muse-wonder-1.0` | multimodal → text | API, Muse Code |
| Muse Spark | `muse-spark-1.3/1.2/1.1` | multimodal → text | API, Muse Code |
| Muse Image | `muse-image-1.0` | text + image → image | API |
| Muse Voice Transcribe | `muse-voice-transcribe-1.0` | audio → text | API |
| SAM 3.1 | `sam-3.1` | text + image/video → boxes & masks | API |
| Muse Spark Open | open weights | multimodal → text | self-host (816B MoE / 42B active) |
| Muse Glimmer | open weights | text + image → text | self-host (30B, Apache-2.0) |

## Pricing (API, per 1M tokens)

| Model | Input | Cached input | Output |
|---|---|---|---|
| Muse Wonder | $4.00 | $0.20 | $20.00 |
| Muse Spark 1.3 | $1.25 | $0.15 | $4.25 |
| Muse Spark 1.3 Contributor | $0.10 | $0.002 | $0.20 |
| Muse Voice Transcribe | — | — | $0.18 / hour |

### Muse Code plans

| Plan | Price/mo | Usage vs Everyday | Muse Wonder | Wonder Full |
|---|---|---|---|---|
| Everyday | $5 | 1× (10–50 prompts / 5h) | Yes | No |
| High | $15 | 5× | Yes | No |
| Power | $50 | 20× | Yes | Yes |
| Maximum | $200 | 80× | Yes | Yes |

## Benchmarks

**Meta-reported — coding**

| Model | Terminal-Bench 2.1 | DeepSWE v1.1 | SWE-Atlas Codebase QnA |
|---|---|---|---|
| Muse Spark 1.2 | 82.9 | 59.3 | — |
| Muse Spark 1.3 | 88.8 | 75.4 | 59.4 |

**Meta-reported — Muse Wonder Full (first frontier models)**

| Benchmark | Wonder Full | Claude Opus 5.5 | GPT-6 Astra |
|---|---|---|---|
| SWE-Marathon | 57.5% | 46.3% | 42.5% |
| DeepSWE v1.1 | 79.0% | 74.2% | 74.1% |
| MemoryBench | 85.5 | 81.5 | — |

**Third-party (Artificial Analysis · Vals AI)**

- AA Intelligence Index v4.3: Opus 5.5 **58** · Wonder Full (max) **56** · Wonder (max) **52** · Spark 1.3 (max) **48**.
- Coding Agents Index (inside Muse Code): Wonder Full **68** (ties Claude Code + Sonnet 5.5) · Opus 5.5 **66** · Wonder **63** · Spark 1.3 **54**.
- Terminal-Bench 4.0: Wonder Full **33% → 57%**, Wonder **33% → 52%**.
- Vals Index: Wonder Full **#5**, ahead of every OpenAI model; ProofBench **94/100** (Spark 1.3: 58).
- Cost per index task: Wonder **$4.52** · Spark 1.3 **$1.60**.

## Caveats

- Meta's benchmark wins are **self-reported** and compare against the prior Opus generation.
- The $0.10 Spark rate is the **Contributor** tier (content may train Meta models).
- Muse Wonder is **preview**; no detailed system card referenced at launch.
- Wonder / Wonder Full are unavailable in **South Korea**.

## Sources

[Meta Model API — Models](https://dev.meta.ai/docs/models) · [Muse Code](https://dev.meta.ai/products/muse-code) · [Build with Muse Code](https://dev.meta.ai/resources/blog/build-with-muse-code) · [Meta AI Research](https://research.meta.ai/blog/introducing-muse-code-and-muse-spark-1-2) · [Latent Space (AA + Vals)](https://latent.space/p/ainews-meta-muse-wonder-and-wonder/) · [musecodes.io](https://musecodes.io/blog/muse-wonder-in-muse-code/)
