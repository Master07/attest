# Real-world proof: GitHub Copilot's merged fix in someone else's app

The app: [pankosmia/roadmap](https://github.com/pankosmia/roadmap) (MIT licence, © 2025 Pankosmia), a static, cross-repository issue board. We didn't write it; it is a test subject. Credit to its authors.

The fix: [pankosmia/roadmap#361](https://github.com/pankosmia/roadmap/pull/361), **written by GitHub Copilot's coding agent** (`copilot-swe-agent`) and merged on 2026-10-28 — "Fix Pull requests button not opening its dialog". Found by a search of merged AI-agent pull requests (see [BENCHMARK](../../../docs/BENCHMARK.md)).

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`c6d7849`](https://github.com/pankosmia/roadmap/commit/c6d7849dc3cfd25e27f2a788b037e842618ff201) | The PR's parent — has the bug |
| fix (Green) | [`66951de`](https://github.com/pankosmia/roadmap/commit/66951deca3fe558f87bd06c901b527c3ca9f1bbd) | Copilot's fix: deletes one line in `open-pulls.js` |
| bad-fix (Break) | local commit on top of base | A plausible wrong fix **we wrote** (not Copilot, not from the repo), defined below and committed here **before** the run |

**The bug.** `open-pulls.js` loads before `app.js`. At load it calls `updatePullsBadge()`, which reads `accessToken` — declared by `app.js`, which hasn't run yet — so it throws `ReferenceError: accessToken is not defined` and the script stops **before** the next line attaches the click listener. In the PR's words: "Clicking the Pull requests button did nothing." Copilot's fix removes the premature call.

**The wrong fix (Break).** The developer's obvious reaction to that console error: wrap the two lines in `try { … } catch {}`. The error disappears from the console — but the listener still sits after the call that throws, so it is never attached and the button stays dead. Checked by hand before the run: on this build the console is clean and clicking "Pull requests" opens nothing.

```js
const pullsButton = document.querySelector("#pulls-button");
try {
  updatePullsBadge();
  if (pullsButton) pullsButton.addEventListener("click", openOpenPullsDialog);
} catch (error) {
  // The badge can run before the token is loaded; do not break the page over it.
}
```

(A `typeof accessToken === "undefined"` guard was considered first and rejected: because `app.js` hasn't run, `accessToken` is undeclared rather than uninitialised, so that guard would actually *fix* the bug.)

**The criterion** ([criteria.yml](criteria.yml)) was written from the PR description and committed **before** any Attest run. It keys on the dialog only: the page's issue list comes from GitHub's public API and can show a rate-limit notice, which is not part of the bug. Checked by hand before the run: base — click, nothing opens; fix — a dialog titled "Open pull requests" opens with "Alerts only", "Refresh" and "Close".

## Reproduce

Third-party history is fetched locally, not pushed to this repo. The page needs internet access (CDN components, public GitHub API).

```bash
git fetch --depth 1 https://github.com/pankosmia/roadmap c6d7849dc3cfd25e27f2a788b037e842618ff201:refs/heads/rw/pr361/base
git fetch --depth 1 https://github.com/pankosmia/roadmap 66951deca3fe558f87bd06c901b527c3ca9f1bbd:refs/heads/rw/pr361/fix
# bad-fix: check out rw/pr361/base on a new branch rw/pr361/bad-fix, apply the try/catch above at the end of open-pulls.js, commit.

npm run attest -- prove --app . --config-dir examples/realworld/roadmap-pulls \
  --base rw/pr361/base --pr rw/pr361/fix --break rw/pr361/bad-fix
```

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here). Nothing is installed from the third-party repo, and the app gets no API keys.

## Runs

Every run is reported here in order, whatever its verdict.

| # | Criteria | Change before the run | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|---|---|
| 1 | `criteria.yml` (frozen in `4c8088d`, with the wrong fix) | none | fail | pass | fail | **PROVEN** | [proofs/realworld/roadmap-361-run1](../../../proofs/realworld/roadmap-361-run1/) |

**Run 1, live, first attempt: PROVEN.** Red (the PR's parent): *"Clicked the Pull requests button twice and waited, but no Open pull requests dialog appeared."* Green (Copilot's fix): *"Dialog titled 'Open pull requests' opened with visible 'Close' button."* Break (our try/catch half-fix): the verifier clicked twice and *"left the board unchanged with no Open pull requests dialog."* The independent Muse Spark Open judge agreed in every phase from the screenshots alone. The click hit-test log shows every click in every phase landed on the real button, `md-outlined-button#pulls-button`, so no phase failed for a missed click. The code checks and SAM had nothing to check (the criterion names no URL, network call or on-screen element) and abstained.

**What this proves, and what it doesn't.** Copilot's one-line fix makes the button work in the running app, and Attest tells it apart from a plausible wrong fix that makes the console error disappear without making the button work — a fix a reviewer checking "no more errors" could approve. The wrong fix is ours, labelled, and committed before the run; the run says nothing about wrong fixes we didn't think of.

`proofs/realworld/roadmap-361-run1/pr-comment.md` shows the comment Attest would post on the PR. It was **not** posted to the roadmap repo.

Re-run it without a key (after the `git fetch` lines and creating `rw/pr361/bad-fix` as above): add `--replay examples/realworld/roadmap-pulls/cassette.jsonl` — a cassette recorded in run 1, not a live run. The page still needs internet for its CDN components.
