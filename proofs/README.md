# Proofs

> **Audience:** judges + devs · **Status:** current · **Last updated:** 2026-11-01 · **Related:** [BENCHMARK](../docs/BENCHMARK.md) · [ARCHITECTURE §8–9](../docs/ARCHITECTURE.md)

Every result the README and BENCHMARK quote is a signed receipt in this folder. Check them all yourself — no API key, no model calls:

```bash
npm run verify-proofs
```

For each receipt it checks the Ed25519 signature, the hash-chained event log (and its pinned length), the hash of every screenshot and video, the criteria hash, and recomputes the verdict from the recorded votes. Change one byte in a bundle and it fails. One receipt at a time: `npm run attest -- verify <path>/receipt.json`. Each bundle also has an `index.html` evidence page (not signed; rendered from the receipt).

What a receipt does **not** prove: it shows nothing was changed after capture, not that the capture environment was honest (see [ARCHITECTURE §13](../docs/ARCHITECTURE.md)). Receipts are signed with a key created on the machine that ran them.

| Bundle | What it shows | Verdict | Run | Judge |
|---|---|---|---|---|
| [pr-1-live](pr-1-live/) | Attest on a real pull request ([Master07/attest#1](https://github.com/Master07/attest/pull/1)): the invisible chat-widget container swallows the Pay click; the PR's fix lets it through; a `z-index` wrong fix is rejected. Posted to the PR as [this comment](pr-1-live/pr-comment.md) | **PROVEN** | live | Muse Spark Open (open weights, Baseten) |
| [benchmark/run-1](benchmark/run-1/) | All 10 planted bugs ([results](benchmark/run-1/results.md)) | 4 PROVEN, 6 INCONCLUSIVE (Meta API 500/503) | live | Muse Wonder |
| [benchmark/run-2](benchmark/run-2/) | Re-run of the 6 hit by API errors ([results](benchmark/run-2/results.md)) | 4 PROVEN, 2 INCONCLUSIVE | live | Muse Wonder |
| TodoMVC (2012, real bug) | A real historical bug and its real fix in a project we didn't write. 103 MB (mostly video), so it is a [release download](../examples/realworld/todomvc-delete/README.md#check-the-receipt) rather than part of the repo | **PROVEN** (run 4 of 4) | live | Muse Wonder |

**Worth opening:** [benchmark/run-2/B04](benchmark/run-2/B04/) — the verifier scrolled sideways and paid on the wrong fix, the code checks agreed, the independent judge disagreed, so Attest refused to certify it (INCONCLUSIVE, not PROVEN). That is the case the four votes exist for; details in [BENCHMARK](../docs/BENCHMARK.md#b04-the-judge-prevented-a-pass-on-a-wrong-fix).

The benchmark runs predate two later prompt changes and the move of the judge to Spark Open; they are reported as they ran. The `results.md` files are the benchmark script's original output and are not signed.
