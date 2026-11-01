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

| # | Date | Verdict | Receipt |
|---|---|---|---|
| — | — | (no run yet) | — |
