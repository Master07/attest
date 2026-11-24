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

## Gate

The baseline above is a machine check, not just a document. T-005 wires it into CI and produces
the one report read to approve P1.

- **`scripts/replay-all.ts`** replays the two in-repo cassettes (checkout-widget, checkout-demo)
  with model hosts blocked and prints one fingerprint line per cassette using the fingerprint
  definition above (`name · verdict · <n> events · fp:<16 hex>`). Each cassette runs in its own
  child process — the replay queue in `src/api.ts` is a process-wide singleton loaded once from
  the first cassette path and never reset, so two cassettes cannot share a process. Evidence is
  written under a temp directory, never inside the repo; `MODEL_API_KEY`, `BASETEN_API_KEY`, any
  `OPENAI_COMPAT*` and any `ATTEST_ROUTE_*` variables are removed from the child environment.
- **`docs/harness/replay-baseline.txt`** holds the two expected lines, copied verbatim from the
  "Replay baseline lines" block above (recorded at `b6b9b6a`, before any code moved). The script
  exits non-zero with the expected and actual lines if either line differs.
- **CI** (`.github/workflows/verify.yml`) runs `npx tsx scripts/replay-all.ts` with
  `ATTEST_BROWSER_CHANNEL: chrome` on macOS, Linux and Windows, alongside `npm run typecheck`,
  `npm test` and `npm run verify-proofs`. The replay step also fetches the `demo2/*` branches the
  same way as `demo/*`. No secrets and no model keys.
- **`docs/harness/P1-GATE.md`** is the gate report: counts per OS, the files moved into core, the
  full `@corbet/harness-core` public API, and the known gaps.

A P1 change passes only if every number and fingerprint in this document comes out the same,
apart from the deltas a card names. The four real-world cassettes stay out of the replay baseline
(they need third-party fetches); `verify-proofs` still checks their committed receipts.

## Fingerprint v2 (P1.1)

Recorded by Opus on 2026-11-25. **v1 above is unchanged and kept as history.** v2 is what the replay check gates on from P1.1 onwards.

### Why
v1 numbers events by `seq` and includes the video events. When Playwright's ffmpeg recorder is missing, as on GitHub's hosted runners, Attest logs `video_unavailable` at the start of each phase instead of `video` at the end. That shifts the event order and changes v1, even though behaviour is identical: same verdict, same 54 events, `fp:4bd38bc3034d14ce` instead of `fp:d849ae1eb892a099` for checkout-widget. Opus reproduced CI's exact v1 values locally by hiding ffmpeg. P1 worked around this by installing ffmpeg in CI; v2 removes the dependency.

### Definition
The same as v1, with two changes:
1. Drop every event whose `kind` is `video` or `video_unavailable`.
2. Number the remaining events by **position** (1, 2, 3, …), not by `seq`.

Each remaining event becomes `[position, phase, kind, picked]`, with `picked` exactly as in v1. JSON-encode each tuple, join with `\n`, SHA-256, and keep the first 16 hex characters. Output: `<verdict> · <n> events · fp2:<16 hex>`.

```js
const VIDEO_KINDS = new Set(["video", "video_unavailable"]);
const events = all.filter((e) => !VIDEO_KINDS.has(e.kind));
const lines = events.map((e, i) => JSON.stringify([i + 1, e.phase, e.kind, pick(e)])); // pick() as in v1
const fp = createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
console.log(`${events.find((e) => e.kind === "verdict")?.data?.verdict} · ${events.length} events · fp2:${fp}`);
```

### Baseline and evidence
Taken from the replays recorded at `b6b9b6a` on 2026-11-24 (before any code moved), and re-checked:

| Cassette | Runs checked | v2 |
|---|---|---|
| checkout-widget | 4 replays (2 at `b6b9b6a`, 2 on `t/T-001`), all with ffmpeg; 1 replay on `main` without ffmpeg | `PROVEN · 51 events · fp2:0bf181c0525b5e16`, every run |
| checkout-demo | 4 replays (2 at `b6b9b6a`, 2 on `t/T-001`), all with ffmpeg; 1 replay on `main` @ `c65cd4c` without ffmpeg | `PROVEN · 51 events · fp2:3a793401b16733a2`, every run |

The no-ffmpeg runs had `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory. Their v1 values were `fp:4bd38bc3034d14ce` and `fp:d67165e2afd00c2b`, the same as GitHub's runners printed, while v2 matched the baseline.

Committed as `docs/harness/replay-baseline-v2.txt` (kept LF on every OS by `.gitattributes`):

```
checkout-widget · PROVEN · 51 events · fp2:0bf181c0525b5e16
checkout-demo · PROVEN · 51 events · fp2:3a793401b16733a2
```
