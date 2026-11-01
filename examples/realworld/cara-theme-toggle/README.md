# Real-world proof: a contributor's fix — Cara's theme button did nothing

The app: [janavipandole/Cara](https://github.com/janavipandole/Cara) (MIT licence) — a static shop site (`index.html`, `app.js`, `js/`), no build. Credit to its authors. **A fix written by a person**, reported in its own row next to the AI-agent proofs.

The bug: [issue #2629](https://github.com/janavipandole/Cara/issues/2629) — "clicking it does nothing. The page stays in light mode." The fix: [PR #2677](https://github.com/janavipandole/Cara/pull/2677) by `adrika4`: the button's id is `themeToggleDesktop`, but the click handler checked `#themeToggle`.

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`a58b83f`](https://github.com/janavipandole/Cara/commit/a58b83fca14d9e72d71573e0295d2143d646c3b3) | First parent of the merge — has the bug |
| fix (Green) | [`8bc1c37`](https://github.com/janavipandole/Cara/commit/8bc1c37ab9d8f7c757c64ce4e4630414ffddf5aa) | Merge of PR #2677: `e.target.closest("#themeToggleDesktop")` |
| bad-fix (Break) | local commit on top of the fix | A plausible wrong fix **we wrote**: the right id, but checked with `e.target.id` — a click lands on the icon inside the button, so it's missed |

**Hand check** (click the centre of the round button at the top right):

| Tree | Theme before → after | Page background after |
|---|---|---|
| base | light → light | white |
| fix | light → **dark** | `rgb(15, 20, 25)` |
| bad-fix (ours) | light → light | white |

Every version, base and fix included, logs `SyntaxError: Identifier 'modalTemplate' has already been declared` at load (a script included twice in the site itself); it doesn't affect the button.

**Found by** a search for small, permissively licensed web apps with a public bug report and a public fix (research agent), then **hand-checked by us** before this commit (Edge, 1280×720, real mouse and keyboard, state read from the page, screenshots compared).

## Runs

Each run is reported here whatever its verdict; a re-run would be numbered and reported too.

## Reproduce

```bash
git fetch --depth 1 https://github.com/janavipandole/Cara a58b83fca14d9e72d71573e0295d2143d646c3b3:refs/heads/rw/cara2677/base
git fetch --depth 1 https://github.com/janavipandole/Cara 8bc1c37ab9d8f7c757c64ce4e4630414ffddf5aa:refs/heads/rw/cara2677/fix
# bad-fix: from the fix, in app.js change `if (e.target.closest("#themeToggleDesktop") || e.target.closest("#themeToggleMobile")) {` to `if (e.target.id === "themeToggleDesktop" || e.target.id === "themeToggleMobile") {`; commit it on a new branch rw/cara2677/bad-fix.

npm run attest -- prove --app . --config-dir examples/realworld/cara-theme-toggle \
  --base rw/cara2677/base --pr rw/cara2677/fix --break rw/cara2677/bad-fix
```

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here). Nothing is installed from the third-party repo, and the app gets no API keys.
