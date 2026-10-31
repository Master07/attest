# Benchmark

Ten small checkout apps with planted UI bugs, used to measure whether Attest catches a
wrong fix whose tests pass (unit tests, or for visual bugs a CSS/HTML source check).

For each scenario there are three versions of the same app:

| Variant | Role | Requirement |
|---|---|---|
| `app/` | Red (base) | Has the bug. The task cannot be completed in the running app. |
| `bad-fix/` | Break | A plausible wrong fix. Its tests pass, but the bug is still there. |
| `fix/` | Green | The real fix. The task works in the running app. |

The directories `bad-fix/` and `fix/` contain files at paths relative to `app/`; the build step
copies them over the base app. A branch contains only that variant's app, with every
`fix/` and `bad-fix/` directory removed, so an agent working on a branch cannot read the answers.

## Commands

```bash
npm run bench -- build           # create local bench/<ID>/<variant> branches
npm run bench -- check           # deterministic probe + bad-fix unit tests (no model calls)
npm run bench -- run [--ids B01,B03]   # run Attest on the branches (calls the Meta API)
```

`check` exits non-zero if a base passes the probe, a fix fails the probe, a bad-fix passes
the probe, or a bad-fix's unit tests fail. Results from `run` go to `evidence/bench-<ts>/`
(gitignored).

## Honesty

The scenarios were written before any Attest run and are not tuned after seeing results.
Every result, including misses and inconclusives, is reported as it is. Bugs are deterministic:
no timing races, randomness or network flakiness.
