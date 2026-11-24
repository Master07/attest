# Harness extraction baseline (P1)

This is the reference every P1 card is judged against: what Attest does **before** any code moves into `packages/harness-core`. A P1 change passes only if every number and fingerprint below comes out the same, apart from the deltas a card names (for example T-001's one extra smoke test).

Recorded by Opus (reviewer), not by a builder, on 2026-11-24.

## Environment

| | |
|---|---|
| Commit | `b6b9b6a5c7899e018f9d394f083b007334d4f17c` (main) |
| Node / npm | v22.22.1 / 10.9.4 |
| OS | macOS (Darwin 27.0.0) |
| Browser for replays | Google Chrome (`ATTEST_BROWSER_CHANNEL=chrome`) |
| Model keys | none set (`MODEL_API_KEY`, `BASETEN_API_KEY` unset; no `.env`) |
| Install | `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci` |

Demo refs (CI creates `demo/*` the same way, in `.github/workflows/verify.yml`):

```bash
git fetch --no-tags origin "+refs/heads/demo/*:refs/heads/demo/*"
git branch demo2/base origin/demo2/base; git branch demo2/fix origin/demo2/fix; git branch demo2/bad-fix origin/demo2/bad-fix
```

| Ref | SHA |
|---|---|
| `demo/base` | `d83a9d0ab9a19767cc5271c66c11fe4b7c29e66f` |
| `demo/fix` | `b898ba91c89b43f39e1593495ced876dc356c26e` |
| `demo/bad-fix` | `64c4324480cc9471445f063ce86f0f222b1712ba` |
| `demo2/base` | `ed301c5de58fbb185748943046363b3f5d4f9863` |
| `demo2/fix` | `91eee12142d3c697535ee91846fbc63b685f6e35` |
| `demo2/bad-fix` | `a305e5bddb6b9bfb2bfd529695685f3a6f108266` |

Without the `demo/*` branches, two tests in `test/doctor.test.ts` fail locally ("a real ref prints a short sha", "a missing Break ref is a note, not a failure"). That is a setup gap, not a bug; CI fetches them.

## Summary

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0, no output |
| `npm test` | **151 tests, 151 pass, 0 fail** |
| `npm run verify-proofs` | **220 of 220 receipts valid** (109 PROVEN, 23 PROVEN_UNCHECKED, 21 REJECTED, 67 INCONCLUSIVE) |
| verify-proofs result lines | sha256 `c933813000d94457236f42b40d67c09503fa17f6ff687cc61c4f2d7357a73007` (over every `✔ …` line plus the `220 of 220` line) |
| Cassette replays | 2 of 2 PROVEN with stable fingerprints (below); 4 real-world cassettes deliberately not in the replay baseline (below) |
| Receipt version | `attest.receipt/0.3` (`RECEIPT_VERSION` in `src/receipt.ts`) |

## Commands and output

### `npm run typecheck`

```
> attest@0.1.0 typecheck
> tsc -p tsconfig.all.json
```

Exit 0.

### `npm test` (last lines)

```
# Subtest: fix verdict: a failed action cannot fake a reproduction or a pass
ok 151 - fix verdict: a failed action cannot fake a reproduction or a pass
  ---
  duration_ms: 0.216166
  type: 'test'
  ...
1..151
# tests 151
# suites 0
# pass 151
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

### `npm run verify-proofs` (last lines)

```
✔ PROVEN           proofs/pr-1-live/receipt.json
✔ REJECTED         proofs/realworld/board-913-run1/receipt.json
✔ PROVEN_UNCHECKED proofs/realworld/board-914-run1/receipt.json
✔ PROVEN           proofs/realworld/board-919-run1/receipt.json
✔ PROVEN_UNCHECKED proofs/realworld/board-921-run1/receipt.json
✔ PROVEN           proofs/realworld/board-921-run2/receipt.json
✔ PROVEN           proofs/realworld/cara-2677-run1/receipt.json
✔ PROVEN           proofs/realworld/cheshy-4-run1/receipt.json
✔ PROVEN_UNCHECKED proofs/realworld/eu-reporter-48-exploratory/receipt.json
✔ PROVEN           proofs/realworld/eu-reporter-48-run1/receipt.json
✔ PROVEN           proofs/realworld/eu-reporter-54-run1/receipt.json
✔ PROVEN           proofs/realworld/hypenosys-run1/receipt.json
✔ PROVEN           proofs/realworld/jspaint-311-run1/receipt.json
✔ PROVEN           proofs/realworld/jspaint-313-replay1/receipt.json
✔ PROVEN           proofs/realworld/jspaint-313-run1/receipt.json
✔ PROVEN           proofs/realworld/jspaint-313-run2/receipt.json
✔ PROVEN_UNCHECKED proofs/realworld/listjs-run1/receipt.json
✔ PROVEN           proofs/realworld/roadmap-361-run1/receipt.json
✔ PROVEN           proofs/realworld/simonw-tools-251-run1/receipt.json

220 of 220 receipts valid
```

To compare after a change: `npm run verify-proofs | grep -E "^(✔|[0-9]+ of)" | shasum -a 256` must print the hash in the summary table.

## Cassette replays

### Why `log.head` is not the baseline

`log.head` (the hash at the end of a receipt's event chain) **changes on every run**, even an identical replay: events carry a timestamp (`ts`), the app's port, click times, and the hashes of freshly captured screenshots and videos. Two replays of the same cassette gave different `log.head` values with the same verdict. So the replay baseline is a **fingerprint** of the fields a refactor must not change, and leaves out the run-specific ones.

### Fingerprint definition

For each event in `events.jsonl`, in order, take `[seq, phase, kind, picked]`, where `picked` is:

| `kind` | Fields kept |
|---|---|
| `phase_start` | `ref` |
| `cua_step` | `step`, `actions`, `errors` |
| `cua_result` | `status`, each verdict's `[id, result]` |
| `checks` | each result's `[id, result, outcomes[kind, result]]` |
| `judge` | `model`, each vote's `[id, result]` |
| `phase_result` | `result` |
| `verdict` | `verdict` |
| anything else | `null` (counted, contents ignored) |

JSON-encode each tuple, join with `\n`, SHA-256, keep the first 16 hex characters. Output: `<verdict> · <event count> events · fp:<16 hex>`.

Reference implementation (T-005 builds `scripts/replay-all.ts` to produce the same output):

```js
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const events = readFileSync(join(process.argv[2], "events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const pick = (e) => {
  const d = e.data ?? {};
  switch (e.kind) {
    case "cua_step": return { step: d.step, actions: d.actions, errors: d.errors };
    case "cua_result": return { status: d.status, verdicts: (d.verdicts ?? []).map((v) => [v.id, v.result]) };
    case "checks": return (d.results ?? []).map((r) => [r.id, r.result, (r.outcomes ?? []).map((o) => [o.kind, o.result])]);
    case "judge": return { model: d.model, votes: (d.votes ?? []).map((v) => [v.id, v.result]) };
    case "phase_result": return d.result;
    case "verdict": return d.verdict;
    case "phase_start": return d.ref;
    default: return null;
  }
};
const lines = events.map((e) => JSON.stringify([e.seq, e.phase, e.kind, pick(e)]));
const fp = createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
console.log(`${events.find((e) => e.kind === "verdict")?.data?.verdict} · ${events.length} events · fp:${fp}`);
```

### Results

Each cassette was replayed **twice**; both runs gave the same fingerprint, and each receipt passed `npm run attest -- verify`.

| Cassette | Cassette sha256 | Command | Verdict | Events | Fingerprint (runs 1 and 2) |
|---|---|---|---|---|---|
| `examples/checkout-widget/cassette.jsonl` | `2b63d12c…09da` | `npm run attest -- prove --app examples/checkout-widget --base demo2/base --pr demo2/fix --break demo2/bad-fix --replay examples/checkout-widget/cassette.jsonl` | PROVEN | 54 | `fp:d849ae1eb892a099` |
| `examples/checkout-demo/cassette.jsonl` | `e633a9ea…09ec` | `npm run attest -- prove --app examples/checkout-demo --base demo/base --pr demo/fix --break demo/bad-fix --replay examples/checkout-demo/cassette.jsonl` | PROVEN | 54 | `fp:795fca3dc280e5e8` |

Both phases' console output matched: red fail, green pass, break fail → "red failed, green passed, break failed".

Replay baseline lines (T-005 commits these as `docs/harness/replay-baseline.txt`):

```
checkout-widget · PROVEN · 54 events · fp:d849ae1eb892a099
checkout-demo · PROVEN · 54 events · fp:795fca3dc280e5e8
```

### Real-world cassettes not in the replay baseline

| Cassette | Why not replayed here |
|---|---|
| `examples/realworld/board-enter/cassette.jsonl` | Needs a fetch of a third-party repo (shizukutanaka/Board) and a bad-fix commit built by hand from the README |
| `examples/realworld/board-focus-trap/cassette.jsonl` | Same (Board #918) |
| `examples/realworld/jspaint-attributes-focus/cassette.jsonl` | Needs a fetch of 1j01/jspaint |
| `examples/realworld/roadmap-pulls/cassette.jsonl` | Needs a fetch of pankosmia/roadmap, a hand-built bad fix, and internet for the page's CDN components |

None of these can replay with the network blocked, so none can run in CI, and the hand-built bad fixes make the replay depend on a manual step. Their committed receipts are among the 220 that `verify-proofs` checks, which covers signatures, hash chains, artifact hashes and recomputed verdicts. The two in-repo cassettes exercise the whole pipeline (workspace, browser, verifier, checks, SAM, judge, verdict, receipt).

## README vs. reality

- README step 2 says the replay needs Edge or Chrome; on this Mac only Chrome is installed, so `ATTEST_BROWSER_CHANNEL=chrome` is required. That works as documented.
- The README doesn't mention that `npm test` needs the `demo/*` branches locally (see Environment).
