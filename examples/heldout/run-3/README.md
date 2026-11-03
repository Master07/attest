# Run 3 — all-paths criteria (exploratory, after unsealing)

**Status:** exploratory and **not blind**. These criteria were written after runs 1–2 were scored
and the labels were unsealed. They ask one question: does Attest catch more wrong fixes when the
criteria cover every path the report names?

## Disclosure

- Before any run, the criteria author had already flagged the single-path limitation in the
  run-1 hand-off (all five harnesses); this run follows up on that note.
- While writing these criteria the author did not see the labels, the candidate diffs, the sealed
  bundle, the unsealed results folder, the results write-up, or the run-1/run-2 result documents.
- The only inputs were the five harness READMEs (the report text and its link), the upstream issue
  or commit each report links to, and the base build at `ho/<p>/<b>/base`.
- No Attest run or model call was made while writing or checking these criteria.
- Because the labels have been unsealed, this is **not** an independent blind evaluation. It is a
  controlled comparison of two criteria sets against the same builds.

## How the criteria were split

Each report was read mechanically for distinct paths: control types, directions, input types and
triggers, plus every "must still work" clause. One criterion was written per path. The first
criterion in every file is the frozen run-1/run-2 criterion, word for word, so run 3 is a strict
superset.

Notes on coverage:

- **p2/b1:** the report says "other input types" (plural). The base page contains one other type,
  the email input; no extra inputs were added to the app.
- **p3/b1:** the report says "arrow keys" without naming a direction for the controls. Only the
  Right arrow (the key that navigates forward on this page) is exercised per control. The report does not name a direction for the controls.
- **p3/b1, contenteditable:** the End key is used to put the caret at the end of the existing text
  so the typed result is deterministic. That is setup, not a separate path.
- **p1/b2:** the RTL direction mapping (Left arrow moves forward, Right arrow moves back) comes
  from the upstream commit the report links to (488c5c8).
- **p3/b2, later navigation:** the Previous button is used because the deck is on its last slide
  after Initialize; Next there does not change the slide.
- Every control type and must-still-work clause named in a report is covered; the notes above
  record the two places where the report is less specific.

## Base checks

Method: Playwright, headless Microsoft Edge, 1280x720, `127.0.0.1`, real mouse and keyboard, base
refs only. Each base was extracted from `ho/<p>/<b>/base:examples/heldout/app` and served with the
harness `serve.cjs`. No model calls. Raw logs and screenshots are outside the repository.

A "bug shown" row means the criterion's `then` is false on the base. A "still works" row means the
`then` is true on the base (a must-keep-working clause).

### p1/b2 — RTL fragment navigation (reveal.js)

| Path named in the report | Criterion | Base result |
|---|---|---|
| Next button: reveal fragments in order, then advance | `rtl-next-reveals-fragments-then-advances` | **bug shown** — the third Next hides "Second point" again instead of advancing |
| Previous button: reverse that sequence | `rtl-previous-reverses-fragments` | **bug shown** — the third Previous shows "First point" again instead of staying put |
| Linear keyboard navigation in RTL | `rtl-left-arrow-moves-forward-right-arrow-back` | **bug shown** — the second Left press hides "First point" instead of revealing "Second point" |

### p2/b1 — shortcuts while typing (impress.js)

| Path named in the report | Criterion | Base result |
|---|---|---|
| Input with no explicit type attribute | `space-in-default-input-does-not-advance` | **bug shown** — the space moves to "Second slide" |
| Other input types | `typing-in-email-input-does-not-advance` | **bug shown** — the space moves to "Second slide" |
| Explicit text input must keep working | `explicit-text-input-keeps-working` | **still works** |
| Shortcuts with the slide focused must keep working | `shortcuts-work-when-slide-has-focus` | **still works** |

### p2/b2 — default substep ordering (impress.js)

| Path named in the report | Criterion | Base result |
|---|---|---|
| Next reveals one default-order substep | `one-next-reveals-one-default-substep` | **bug shown** — all three appear at once |
| Previous hides one default-order substep | `previous-hides-one-default-substep` | **bug shown** — all three hide at once |
| Explicitly equal ordered substeps stay grouped | `explicitly-ordered-substeps-still-group` | **still works** |

### p3/b1 — arrow keys in editable controls (deck.js)

| Path named in the report | Criterion | Base result |
|---|---|---|
| Input | `right-arrow-in-input-stays-on-slide` | **bug shown** — moves to "Third slide" |
| Textarea | `right-arrow-in-textarea-stays-on-slide` | **bug shown** — moves to "Third slide" |
| Contenteditable | `right-arrow-in-contenteditable-stays-on-slide` | **bug shown** — moves to "Third slide" |
| Keyboard navigation outside the controls must keep working | `keyboard-navigation-outside-controls-still-works` | **still works** |

### p3/b2 — status after re-initialising (deck.js)

| Path named in the report | Criterion | Base result |
|---|---|---|
| Initialize while midway through the slides | `reinitialise-keeps-current-status` | **bug shown** — status reads "1" while "Third slide" is showing |
| Status after later navigation | `status-correct-after-subsequent-navigation` | **still works** — Previous gives "Second slide" and "2 / 3" |

## Commands

Workflow A (candidate in the Green position, no Break), then workflow B (with the bug's Break).
`C02` and `C08` (p1/b1) stay excluded; that bug's Break is not used.

```bash
# p1/b2 — C03, C07
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p1-b2 --base ho/p1/b2/base --pr ho/C03/candidate --out proofs/heldout/run-3/C03-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p1-b2 --base ho/p1/b2/base --pr ho/C03/candidate --break ho/p1/b2/break --out proofs/heldout/run-3/C03-B
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p1-b2 --base ho/p1/b2/base --pr ho/C07/candidate --out proofs/heldout/run-3/C07-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p1-b2 --base ho/p1/b2/base --pr ho/C07/candidate --break ho/p1/b2/break --out proofs/heldout/run-3/C07-B

# p2/b1 — C10, C12
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p2-b1 --base ho/p2/b1/base --pr ho/C10/candidate --out proofs/heldout/run-3/C10-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p2-b1 --base ho/p2/b1/base --pr ho/C10/candidate --break ho/p2/b1/break --out proofs/heldout/run-3/C10-B
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p2-b1 --base ho/p2/b1/base --pr ho/C12/candidate --out proofs/heldout/run-3/C12-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p2-b1 --base ho/p2/b1/base --pr ho/C12/candidate --break ho/p2/b1/break --out proofs/heldout/run-3/C12-B

# p2/b2 — C04, C06
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p2-b2 --base ho/p2/b2/base --pr ho/C04/candidate --out proofs/heldout/run-3/C04-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p2-b2 --base ho/p2/b2/base --pr ho/C04/candidate --break ho/p2/b2/break --out proofs/heldout/run-3/C04-B
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p2-b2 --base ho/p2/b2/base --pr ho/C06/candidate --out proofs/heldout/run-3/C06-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p2-b2 --base ho/p2/b2/base --pr ho/C06/candidate --break ho/p2/b2/break --out proofs/heldout/run-3/C06-B

# p3/b1 — C01, C05
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p3-b1 --base ho/p3/b1/base --pr ho/C01/candidate --out proofs/heldout/run-3/C01-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p3-b1 --base ho/p3/b1/base --pr ho/C01/candidate --break ho/p3/b1/break --out proofs/heldout/run-3/C01-B
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p3-b1 --base ho/p3/b1/base --pr ho/C05/candidate --out proofs/heldout/run-3/C05-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p3-b1 --base ho/p3/b1/base --pr ho/C05/candidate --break ho/p3/b1/break --out proofs/heldout/run-3/C05-B

# p3/b2 — C09, C11
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p3-b2 --base ho/p3/b2/base --pr ho/C09/candidate --out proofs/heldout/run-3/C09-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p3-b2 --base ho/p3/b2/base --pr ho/C09/candidate --break ho/p3/b2/break --out proofs/heldout/run-3/C09-B
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p3-b2 --base ho/p3/b2/base --pr ho/C11/candidate --out proofs/heldout/run-3/C11-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/run-3/p3-b2 --base ho/p3/b2/base --pr ho/C11/candidate --break ho/p3/b2/break --out proofs/heldout/run-3/C11-B
```

No expected verdicts are recorded in this directory.
