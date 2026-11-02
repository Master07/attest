# Real-world proof: List.js and the search field's clear button (2014)

> **Exploratory, not pre-registered.** The criterion was written before the run but committed only afterwards. The page is ours: these commits ship `dist/list.js` but no demo page, so the harness serves each commit's `dist/list.js` with a minimal page we wrote. The fix was written by a person, and there is no Break.

The library: [javve/list.js](https://github.com/javve/list.js) (MIT licence, © Jonny Strömberg). Credit to its author.

The bug: typing in a List.js search field filters the list on `keyup`. The browser's clear button (×) empties the field with an `input` event and no `keyup`, so the list stays filtered. The fix: [`c6a4a6d`](https://github.com/javve/list.js/commit/c6a4a6dec423df83b21cc5fb90890b1c8de2ee05) "Fix support for the HTML5 clear button" by Jonny Strömberg, 2014-03-21. It changes `src/search.js` only, and first ships in `dist/list.js` with release 1.1.1.

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`18f3f30`](https://github.com/javve/list.js/commit/18f3f306991e5c90ef8c37478f978ae6a953241f) | The fix's parent |
| fix (Green) | [`9754c28`](https://github.com/javve/list.js/commit/9754c28262b07e647e0ad3de181cdb4e323e7db7) | Release 1.1.1, the first commit whose `dist/list.js` contains the fix |

**The page** ([index.html](index.html), ours): a search field and the names Jonny, Jonas, Martina, Gustaf, wired up with `new List("users", { valueNames: ["name"] })`. [serve.cjs](serve.cjs) serves it with the checked-out commit's `dist/list.js`.

**The criterion** ([criteria.yml](criteria.yml)): type Mar, click the clear button. The field should be empty and all four names shown.

## Runs

| # | Kind | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|---|
| 1 | live | fail | pass | — | **PROVEN_UNCHECKED** | [proofs/realworld/listjs-run1](../../../proofs/realworld/listjs-run1/) |

Red: *"After typing Mar and clicking the clear X, the field was empty but only Martina was shown instead of all four names."* Green: *"the search field was empty and all four names Jonny, Jonas, Martina and Gustaf were shown."* The judge (Muse Spark Open on Baseten) agreed in both phases. There is no wrong fix, so Attest's ability to reject one wasn't tested, hence PROVEN_UNCHECKED.

## Reproduce

```bash
git fetch https://github.com/javve/list.js 18f3f306991e5c90ef8c37478f978ae6a953241f:refs/heads/rw/live/list/red
git fetch https://github.com/javve/list.js 9754c28262b07e647e0ad3de181cdb4e323e7db7:refs/heads/rw/live/list/green

npm run attest -- prove --app . --config-dir examples/realworld/listjs-clear \
  --base rw/live/list/red --pr rw/live/list/green
```
