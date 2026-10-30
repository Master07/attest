# Cost

> **Audience:** judges + team · **Status:** draft · **Last updated:** 2026-10-27 · **Related:** [MODEL_STRATEGY](MODEL_STRATEGY.md) · [reference/muse-models](reference/muse-models.md)

Attest's routing exists to keep runs inside the hackathon's **$150 Model API credits**.

## API rates (per 1M tokens)

| Model | Input | Cached input | Output |
|---|---|---|---|
| `muse-spark-1.3` | $1.25 | $0.15 | $4.25 |
| `muse-spark-1.3-contributor` | $0.10 | $0.002 | $0.20 |
| `muse-wonder-1.0` | $4.00 | $0.20 | $20.00 |
| Muse Wonder Full | — | — | plan-only (no per-token price) |
| Muse Voice Transcribe | — | — | $0.18 / hour of audio |

## Worked example

A task reading **200k uncached input** and writing **20k output**:

| Model | Math | Cost |
|---|---|---|
| Spark 1.3 | 0.2 × $1.25 + 0.02 × $4.25 | **≈ $0.34** |
| Spark 1.3 Contributor | 0.2 × $0.10 + 0.02 × $0.20 | **≈ $0.024** |
| Muse Wonder | 0.2 × $4.00 + 0.02 × $20.00 | **≈ $1.20** |

**Read:** Wonder costs ~3.6× Spark for the same tokens, ~50× the Contributor tier — and output-heavy work widens the gap (Wonder's output rate is nearly 5× Spark's).

## What a demo run costs

Estimate for one full Attest run (plan + 6 parallel workers + 1 merge escalation + verification):

- 6 workers on **Spark 1.3 Contributor** — the bulk of tokens, at the cheapest rate.
- 1 merge escalation on **Wonder Full** — plan-included (Power/Maximum).
- Verification passes — a small number of driven steps.

Because the heavy parallel work runs on the cheapest tier and only the escalation touches the frontier model, a run stays in the **low single-digit dollars**, so $150 covers many demo iterations. Confirm real numbers from the event log after the first run and record them here.

## Plan-based alternative

If you're on a Muse Code subscription instead of API credits: **Power ($50)** or **Maximum ($200)** are required for Muse Wonder Full. Plans are capped (no top-ups) — see [reference/muse-models](reference/muse-models.md#muse-code-plans).

## Watch-outs

- Contributor mode is **on by default** for subscribers — cheaper usage, but content may train Meta models.
- Wonder is still **preview** and had a launch-day metering bug; don't judge a plan on early numbers.
- `/effort` — reasoning tokens bill as output; dial down on easy tasks.

## See also

- [MODEL_STRATEGY](MODEL_STRATEGY.md) — the routing that keeps this cheap
- [reference/muse-models](reference/muse-models.md) — full pricing and benchmark matrix
