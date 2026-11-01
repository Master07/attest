# Real-world proof: GitHub Copilot's merged fix for typing a display name in cheshy-mess

The app: [kq4cin/cheshy-mess](https://github.com/kq4cin/cheshy-mess) (MIT licence) — an offline-first React + Vite chess app. Credit to its author.

The fix: [kq4cin/cheshy-mess#4](https://github.com/kq4cin/cheshy-mess/pull/4), **written by GitHub Copilot** and merged on 2026-10-28 — "Fix display name editing and dialog focus".

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`cdf7b19`](https://github.com/kq4cin/cheshy-mess/commit/cdf7b19f24d83f4dbda8323f34754056280b8aad) | The PR's parent — has the bug |
| fix (Green) | [`074c3ae`](https://github.com/kq4cin/cheshy-mess/commit/074c3aeaa2d7599eeea0a17fef8055f338354c1e) | Copilot's fix in `src/App.tsx` (plus a Playwright test) |
| bad-fix (Break) | local commit on top of the fix | A plausible wrong fix **we wrote**, defined below and committed here **before** the run |

**The bug.** The Settings dialog refocuses its close button after every render, so typing in DISPLAY NAME keeps one character and focus jumps to "Close dialog".

**The wrong fix (Break).** Copilot's input change only (`defaultValue`), leaving the dialog's focus effect unchanged — the close button still steals focus on every keystroke.

**Checked by hand before the run** (Edge, 1280×720, real input: Settings, click the end of DISPLAY NAME, type `Bob`):

| Tree | Field value | Focus |
|---|---|---|
| base | `Guest 6647B` | "Close dialog" button |
| fix | `Guest 2229Bob` | the field |
| bad-fix (ours) | `Guest 3749B` | "Close dialog" button |

(The default name is random per load.) **This app needs `npm ci`:** done with `--ignore-scripts`, lockfile resolving only from registry.npmjs.org, and Attest gives the app no API keys.

## Runs

Each run is reported here whatever its verdict.

## Reproduce

```bash
git fetch --depth 1 https://github.com/kq4cin/cheshy-mess cdf7b19f24d83f4dbda8323f34754056280b8aad:refs/heads/rw/ch4/base
git fetch --depth 1 https://github.com/kq4cin/cheshy-mess 074c3aeaa2d7599eeea0a17fef8055f338354c1e:refs/heads/rw/ch4/fix
# bad-fix: from rw/ch4/fix, in src/App.tsx Modal, restore the single useEffect that focuses closeRef and adds the
# Escape listener with [onClose] deps (as on base); commit.
npm run attest -- prove --app . --config-dir examples/realworld/cheshy-typing --base rw/ch4/base --pr rw/ch4/fix --break rw/ch4/bad-fix
```
