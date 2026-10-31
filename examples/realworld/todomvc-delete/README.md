# Real-world proof: TodoMVC's "delete a todo" bug (2012)

A real bug, fixed in real history, in a project we didn't write: [TodoMVC](https://github.com/tastejs/todomvc) (MIT licence), vanilla JavaScript example.

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`8d004d8`](https://github.com/tastejs/todomvc/commit/8d004d8f3b579a4393086e4427c777a2e43b1396) | "Vanillajs app: Enforce code style" — has the bug |
| fix (Green) | [`124b1c9`](https://github.com/tastejs/todomvc/commit/124b1c996171ba14f558ab401da4f986c0ec4239) | "Vanillajs app: Fix bug when removing a single todo item" — the real fix |
| bad-fix (Break) | local commit on top of base | A plausible wrong fix **we wrote** (compare ids with `==` "because data attributes are strings"); not from TodoMVC |

**The bug:** `removeTodoById` splices the array inside a loop that still runs to the old length, then reads `todos[i].id` on `undefined` and throws before the list is redrawn. Deleting any item but the last one leaves it on screen; clicking delete **a second time** removes it.

## Reproduce

Third-party history is fetched locally, not pushed to this repo.

```bash
git fetch --depth 1 https://github.com/tastejs/todomvc 8d004d8f3b579a4393086e4427c777a2e43b1396:refs/heads/rw/delete/base
git fetch --depth 1 https://github.com/tastejs/todomvc 124b1c996171ba14f558ab401da4f986c0ec4239:refs/heads/rw/delete/fix
# bad-fix: check out rw/delete/base on a new branch rw/delete/bad-fix and change, in
# vanilla-examples/vanillajs/js/app.js, `todos[ i ].id === id` to `todos[ i ].id == id`; commit.

npm run attest -- prove --app . --config-dir examples/realworld/todomvc-delete \
  --criteria examples/realworld/todomvc-delete/criteria.single-click.yml \
  --base rw/delete/base --pr rw/delete/fix --break rw/delete/bad-fix
```

`attest.yml` serves the old repo with `serve.cjs` (a dependency-free static server kept here, outside the third-party tree) and opens `/vanilla-examples/vanillajs/index.html`.

## Every run, in order

| # | Criteria | Change before the run | Red | Green | Break | Verdict |
|---|---|---|---|---|---|---|
| 1 | `criteria.yml` | — | pass ✗ | pass | pass ✗ | INCONCLUSIVE |
| 2 | `criteria.single-click.yml` | verifier retry rule tightened | fail (judge: pass) | pass | fail (judge: pass) | INCONCLUSIVE |
| 3 | `criteria.single-click.yml` | judge sees all frames, not just before/after | fail | pass | fail (judge: pass) | INCONCLUSIVE |
| 4 | `criteria.single-click.yml` | none (repeat of run 3) | fail | pass | fail | **PROVEN** |

What happened:

1. **Run 1 — the requirement was ambiguous.** It didn't say "single click". The verifier followed its rule to retry an action with no visible effect, and the second click made the bug disappear. Every voter said pass on base, so Attest reported "bug not reproduced" instead of a proof.
2. **Run 2 — the verifier got it exactly right** ("first single click … left both todos visible, and only a second click removed it"). But the judge saw only the first and last screenshots, and the last one looked fixed after the confirming click, so it disagreed.
3. **Run 3 — with the full frame sequence, the judge agreed on Red** ("frames after the first delete attempt still show both"), but voted pass on Break from almost identical frames.
4. **Run 4 — a straight repeat: every voter agreed. PROVEN.**

Takeaways, stated plainly:

- The real bug reproduces in today's browser and Attest proves the real 2012 fix.
- Wording matters: "delete" vs "delete with a single click" changed the outcome. A human approves the criteria for this reason.
- Two Attest changes came out of this case (both apply to all runs since): the verifier judges a single stated action by its first attempt, and the judge sees the whole screenshot sequence.
- The judge was inconsistent on the wrong fix in 1 of 2 identical runs. In every run, disagreement produced INCONCLUSIVE — **no run certified the wrong fix**.

## Check the receipt

Run 4's signed bundle (receipt, event log, screenshots, videos) is a [release download](https://github.com/Master07/attest/releases/tag/proofs-2026-11-01): 101 MB, because its three phase videos are hashed into the receipt. It contains Attest's run output only, no TodoMVC code.

```bash
# from a clone of this repo, after npm install; download todomvc-delete-run-4.zip from the release
unzip todomvc-delete-run-4.zip            # Windows: Expand-Archive todomvc-delete-run-4.zip .
npm run attest -- verify todomvc-delete-run-4/receipt.json
```

Zip SHA-256: `061450dad90c45ea439935c377be3748d3553197834825300b61d3652f5cd32a`. Runs 1–3 are described above, not published.

## The candidate that didn't reproduce

The first candidate we tried — TodoMVC's July 2012 "Fix clear completed button being unclickable" (`98d5b38`) — **does not reproduce in today's Edge**: the click reaches the button on both commits. Attest would report "bug not reproduced in this environment", which is the honest outcome for a bug the browser no longer has.
