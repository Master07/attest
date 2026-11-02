# Real-world proof: Devin's merged keyboard fix — the Share dialog's focus trap

The app: [shizukutanaka/Board](https://github.com/shizukutanaka/Board) (MIT licence, © 2026 shizukutanaka) — the same single-file whiteboard as the [Board#921 proof](../board-enter/README.md), a different bug and a different fix. Credit to its author.

The fix: [shizukutanaka/Board#918](https://github.com/shizukutanaka/Board/pull/918), **written by Devin** (`devin-ai-integration`) and merged on 2026-10-08 — "closed-`<details>` children excluded from the modal focus trap". Found by the second search of merged AI-agent pull requests.

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`5c49e50`](https://github.com/shizukutanaka/Board/commit/5c49e50fa8b685e741ce9ac7b0bbe55b738225ff) | The PR's parent — has the bug |
| fix (Green) | [`37207f3`](https://github.com/shizukutanaka/Board/commit/37207f3b8c50d13394815b9404886e18fb50bf31) | Devin's fix: one filter in `index.html` (plus tests and docs) |
| bad-fix (Break) | local commit on top of base | A plausible wrong fix **we wrote** (not Devin, not from the repo), defined below and committed here **before** the run |

**The bug.** The Share dialog keeps keyboard focus inside itself by wrapping Tab from its last control back to its first. On base, its list of controls also includes ten controls inside the *closed* "Direct peer connection (experimental)" section, which aren't rendered. So the trap thinks the "Direct peer connection" row isn't the last control, doesn't wrap, and one Tab sends focus out of the dialog to the page behind it. Devin's fix drops children of a closed `<details>` (except its summary) from the list.

**Checked by hand before the run** (real Tab presses at 1280×720, focus read from the page): from the "Direct peer connection" row, one Tab → base: focus on the page body behind the dialog, no focus outline anywhere in the dialog; fix: focus outline on the dialog's × close button.

**The wrong fix (Break).** Devin's filter applied to inputs and buttons only — a developer who forgets that the hidden panel also has text areas. The text areas stay in the trap's list, so it still aims past the last visible control. Checked by hand: one Tab from the "Direct peer connection" row leaves the dialog, as on base.

```js
.filter(el=>{if(el.disabled||el.hidden)return false;const d=el.matches?.('input,button')&&el.closest?.('details:not([open])');return !d;});
```

**The criterion** ([criteria.yml](criteria.yml)) was written from the PR description and committed **before** any Attest run, with the wrong fix. This is a keyboard bug judged from screenshots: the only visible difference is where the focus outline is after one Tab, so the criterion names that step exactly. A screenshot-only verifier may find it harder than a click bug; whatever the result, it is reported here.

## Reproduce

```bash
git fetch --depth 1 https://github.com/shizukutanaka/Board 5c49e50fa8b685e741ce9ac7b0bbe55b738225ff:refs/heads/rw/board918/base
git fetch --depth 1 https://github.com/shizukutanaka/Board 37207f3b8c50d13394815b9404886e18fb50bf31:refs/heads/rw/board918/fix
# bad-fix: check out rw/board918/base on a new branch rw/board918/bad-fix, replace the focus-trap filter
# `.filter(el=>!el.disabled&&!el.hidden);` in index.html with the line above, commit.

npm run attest -- prove --app . --config-dir examples/realworld/board-focus-trap \
  --base rw/board918/base --pr rw/board918/fix --break rw/board918/bad-fix
```

## Runs

Every run is reported here in order, whatever its verdict.

| # | Criteria | Change before the run | Red | Green | Break | Verdict |
|---|---|---|---|---|---|---|
| 1 | `criteria.yml` (frozen in `fe026f5`, with the wrong fix) | none | fail | pass | inconclusive | **INCONCLUSIVE** |
| 2 | same | judge frame cap 8 → 32 | fail | pass | fail | **PROVEN** — verifier alone; the judge could not vote |
| 3 | same | judge sees every frame as contact sheets | fail | pass | fail | **PROVEN** — verifier and judge agree in every phase |

All three signed bundles are one release download: [`proofs-board918-2026-11-01`](https://github.com/Master07/attest/releases/tag/proofs-board918-2026-11-01) (`board-918-runs-1-3.zip`, 124 MB because long keyboard flows make long phase videos; SHA-256 `ea2f5a3c71ccf22e2365faf452ad8471b4302ee02fb2bf1a48215883decf9d5b`). Unzip, then `npm run attest -- verify board-918-run3/receipt.json`.

**Run 1 — INCONCLUSIVE, and nothing was certified.** The verifier was right in all three phases. On Break it pressed Tab past "Direct peer connection" and saw *"no control inside the Share dialog showed a focus outline"*. But the independent judge then saw only **8 of the phase's 19 screenshots** (evenly sampled); the one frame where focus had left the dialog was sampled out, so it saw "focus on Direct peer connection" followed by "focus on ×" and voted pass. The votes disagreed, and disagreement is never a pass.

**Run 2 — PROVEN on the verifier alone.** We raised the judge's frame cap from 8 to 32. Muse Spark Open on Baseten rejects more than 8 images per request (`HTTP 400 "Too many images: 18 (max 8)"`), so the judge could not vote in any phase; the verdict rests on the verifier, and the receipt, evidence page and PR comment now say so ("Judge did not vote in 3 of 3 phases"). The cap change was reverted. From receipt version 0.2, a required judge that gives no vote makes the criterion INCONCLUSIVE, so this run would no longer be PROVEN; the published receipt is 0.1 and re-verifies unchanged.

**Run 3 — PROVEN, both models agreeing.** Phases with more than 8 screenshots now reach the judge as **contact sheets** — up to 4 consecutive frames per image, each labelled with its frame number — so a 20-frame phase arrives whole within the 8-image limit. Red: the judge, *"Frame 7 shows focus on the Direct peer connection row but … Frame 8 shows no visible focus outline … inside the Share dialog"*. Green: *"Frame 8, the very next frame, shows the visible focus outline wrapped to the X close button"*. Break: the judge caught the escape twice (*"Frame 7 then Frame 8, and again Frame 17 then Frame 18"*). Same frozen criterion and wrong fix as run 1.

**What this proves, and what it doesn't.** Devin's fix keeps keyboard focus inside the dialog in the running app, and Attest tells it apart from a fix that handles only the hidden inputs and buttons. It also shows two blind spots in Attest's own judge, found on a real case and fixed — and that while they existed, Attest refused to certify rather than guess. The wrong fix is ours; run 3 came after two changes to Attest's judge, which is why every run is reported.

Re-run run 3 without a key (after the `git fetch` lines and creating `rw/board918/bad-fix`): add `--replay examples/realworld/board-focus-trap/cassette.jsonl`.
