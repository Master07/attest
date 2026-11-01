# Real-world proof: Devin's find-box Escape fix, and the commit before it that broke Escape

The app: [shizukutanaka/Board](https://github.com/shizukutanaka/Board) (MIT licence, © 2026 shizukutanaka) — the same single-file whiteboard as the [Board#921](../board-enter/README.md) and [Board#918](../board-focus-trap/README.md) proofs, a different change. Credit to its author.

Two pull requests, **both written by Devin** (`devin-ai-integration`), found by a search for merged AI-agent fixes that a later pull request says did not work:

- [Board#913](https://github.com/shizukutanaka/Board/pull/913) (round901) says: "Esc in `sqinput` now folds the box" — `sqinput` is the find box opened with Ctrl+F.
- [Board#914](https://github.com/shizukutanaka/Board/pull/914) (round902) says #913 "introduced a real regression ... Esc closed then immediately reopened in real browsers (the harness only exercises window listeners, so round901's pins passed green)", and fixes it.

**This is not a fix that shipped broken.** #913 and #914 were stacked pull requests: #913 merged into another Devin branch, not `main`, with #914 on top of it, and they merged seconds apart. The broken commit was fixed before it reached `main` on its own. What it is: a fix commit written by an AI agent, whose own tests passed, that did not do what it said in a real browser — confirmed by the same agent's next pull request.

| Ref | Commit | What it is |
|---|---|---|
| `rw/b913/base` | [`3aa7dab`](https://github.com/shizukutanaka/Board/commit/3aa7dab50f9b83ce306763646364d36f571f930b) | Parent of #913's commit |
| `rw/b913/fix` = `rw/b914/base` | [`1a7d4b1`](https://github.com/shizukutanaka/Board/commit/1a7d4b13698b5c86b9c1f8d7814224566009224d) | #913's commit (round901), by Devin |
| `rw/b914/fix` | [`2f67c97`](https://github.com/shizukutanaka/Board/commit/2f67c972eb34f05cbf913ccf54b015b8cb62fca4) | #914's commit (round902), by Devin; its parent is `1a7d4b1` |

**Checked by hand before any run** (Edge, 1280×720, real input: click the canvas, Ctrl+F, type `rect`, Escape, wait 0.6 s, read the page):

| Tree | Find box after Escape | Focus |
|---|---|---|
| `3aa7dab` (before #913) | closed (`display: none`) | canvas |
| `1a7d4b1` (#913) | **still open** (`display: block`), the screenshot shows the empty search field | the find box |
| `2f67c97` (#914) | closed | canvas |

The bug #913 describes on its parent (Esc leaves the box open) did not show in a real browser: the box's own listener already closed it. #914's description explains why #913's tests saw something else.

**The criterion** ([criteria.yml](criteria.yml)) is #913's own claim — press Escape in the find box and it closes — committed **before** any Attest run. The same criterion is used for both runs.

## Runs (pre-registered)

| Run | Base (Red) | PR (Green) | Break | What we expect, and why |
|---|---|---|---|---|
| A — #913 | `rw/b913/base` | `rw/b913/fix` | none | **REJECTED**: Green fails, because Escape no longer closes the box. Red is expected to *pass* ("bug not reproduced"), since the box already closed before #913. |
| B — #914 | `rw/b914/base` | `rw/b914/fix` | none | **PROVEN_UNCHECKED**: Red fails (the box comes back), Green passes. No wrong fix exists in the history and we don't add one, so the Break check is left out. |

Each run is reported here whatever its verdict; a re-run would be numbered and reported too.

## Reproduce

```bash
git fetch --depth 1 https://github.com/shizukutanaka/Board 3aa7dab50f9b83ce306763646364d36f571f930b:refs/heads/rw/b913/base
git fetch --depth 1 https://github.com/shizukutanaka/Board 1a7d4b13698b5c86b9c1f8d7814224566009224d:refs/heads/rw/b913/fix
git fetch --depth 1 https://github.com/shizukutanaka/Board 2f67c972eb34f05cbf913ccf54b015b8cb62fca4:refs/heads/rw/b914/fix
git branch rw/b914/base rw/b913/fix

npm run attest -- prove --app . --config-dir examples/realworld/board-find-esc --base rw/b913/base --pr rw/b913/fix   # run A
npm run attest -- prove --app . --config-dir examples/realworld/board-find-esc --base rw/b914/base --pr rw/b914/fix   # run B
```

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here). Nothing is installed from the third-party repo, and the app gets no API keys.
