# Real-world proof: an AI agent's merged fix in someone else's app

The app: [shizukutanaka/Board](https://github.com/shizukutanaka/Board) (MIT licence, © 2026 shizukutanaka), a single-file whiteboard. We didn't write it; it is a test subject. Credit to its author.

The fix: [shizukutanaka/Board#921](https://github.com/shizukutanaka/Board/pull/921), **written by Devin** (`devin-ai-integration`) and merged on 2026-10-08 — "focused button owns Enter/Space — no canvas double-action".

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`d896961`](https://github.com/shizukutanaka/Board/commit/d896961a8262e635d38dfd8174168aca6418a104) | The PR's parent — has the bug |
| fix (Green) | [`f05983d`](https://github.com/shizukutanaka/Board/commit/f05983dd3c1a5a7fab3c93ad9ba21981fb5e48a3) | Devin's fix: one guard line in `index.html` (plus tests and docs) |
| Break | none | No wrong fix exists in the PR's history, so the honest ceiling is `PROVEN_UNCHECKED` |

**The bug, in the PR's words:** with a toolbar button focused, Enter "suppressed the button's native click" while the canvas shortcut ran `createShapeKbd()` — a shape "stamped at view center". So a user who activates a toolbar button from the keyboard gets a shape they never drew.

**The criterion** ([criteria.yml](criteria.yml)) was written from that description and committed **before** any Attest run. It will not be edited after a result; any change would be a new, numbered run reported below.

## Reproduce

Third-party history is fetched locally, not pushed to this repo.

```bash
git fetch --depth 1 https://github.com/shizukutanaka/Board d896961a8262e635d38dfd8174168aca6418a104:refs/heads/rw/board921/base
git fetch --depth 1 https://github.com/shizukutanaka/Board f05983dd3c1a5a7fab3c93ad9ba21981fb5e48a3:refs/heads/rw/board921/fix

npm run attest -- prove --app . --config-dir examples/realworld/board-enter \
  --base rw/board921/base --pr rw/board921/fix
```

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here, outside the third-party tree) and opens `/index.html`. Nothing is installed from the third-party repo, and the app gets no API keys (see ARCHITECTURE §12).

## Runs

Every run is reported here in order, whatever its verdict.

| # | Date | Verdict | Receipt |
|---|---|---|---|
| — | — | (no run yet) | — |
