# Real-world proof: JS Paint's Attributes dialog ignores typing (issue #313)

> **Exploratory, not pre-registered.** The criterion was written before any run and never edited, but it was committed to this repo only after the runs. Every run is reported. The fix was written by a person.

The app: [1j01/jspaint](https://github.com/1j01/jspaint) (MIT licence, © 2022 Isaiah Odhner). JS Paint is static files with no build. Credit to its author.

The bug: issue [#313](https://github.com/1j01/jspaint/issues/313), reported by suchipi: the "Width" field is not focused and selected when you open Image → Attributes, so typing a size does nothing. The fix: [`e0ae75b`](https://github.com/1j01/jspaint/commit/e0ae75bd808d024c74de7f6db2de148bbdb418b9) by Isaiah Odhner, "Focus width field by default in image attributes dialog". It replaces the OK button's focus with `$width.select()`.

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`8e37f20`](https://github.com/1j01/jspaint/commit/8e37f20514f5ff6a3ee8410dc932b8cccd964e1e) | The fix's parent, which has the bug |
| fix (Green) | [`e0ae75b`](https://github.com/1j01/jspaint/commit/e0ae75bd808d024c74de7f6db2de148bbdb418b9) | The maintainer's fix |
| bad-fix (Break) | local commit on top of the fix | A wrong fix **we wrote**: `$width.focus()` instead of `$width.select()`. Typing then goes to the end of the field instead of replacing its value |

**The criterion** ([criteria.yml](criteria.yml)): open Image > Attributes with Ctrl+E and, without clicking, type 320, Tab, 240. The dialog should show Width 320 and Height 240.

## Runs

| # | Kind | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|---|
| 1 | live, no video | fail | pass | fail | **PROVEN** | [proofs/realworld/jspaint-313-run1](../../../proofs/realworld/jspaint-313-run1/) |
| 2 | live, with video | fail | pass | fail | **PROVEN** | [proofs/realworld/jspaint-313-run2](../../../proofs/realworld/jspaint-313-run2/) |
| replay | run 1's cassette, no key | fail | pass | fail | **PROVEN** (marked as a replay) | [proofs/realworld/jspaint-313-replay1](../../../proofs/realworld/jspaint-313-replay1/) |

**Why there are two live runs.** Run 1 recorded no video because Playwright's ffmpeg wasn't installed on that machine. Attest fell back to an unrecorded browser, as designed, but said nothing about it. Run 2 repeated the run unchanged with video on. Both are reported. Attest now warns and logs `video_unavailable` when this happens.

**What the runs saw.** Run 1, Red: *"the dialog still showed Width 683 and Height 384 instead of 320 and 240."* Green: *"Attributes dialog shows Width 320 and Height 240 after typing without clicking."* Break: *"Typing 320 appended to the existing width to show 683320 instead of 320."* That is exactly the difference between `focus()` and `select()`. The independent judge (Muse Spark Open on Baseten) agreed in every phase of both live runs. The code checks and SAM had nothing to check and abstained.

**What this shows, and what it doesn't.** The maintainer's fix works in the running app, and Attest rejects a fix that focuses the field but doesn't select its value, two one-word-different lines. The wrong fix is ours. Because the criterion was committed after the runs, this is not a pre-registered result.

## Reproduce

```bash
git fetch --depth 1 https://github.com/1j01/jspaint 8e37f20514f5ff6a3ee8410dc932b8cccd964e1e:refs/heads/rw/jspaint/base
git fetch --depth 1 https://github.com/1j01/jspaint e0ae75bd808d024c74de7f6db2de148bbdb418b9:refs/heads/rw/jspaint/fix
# bad-fix: from rw/jspaint/fix, in src/functions.js, function image_attributes(), change `$width.select();` to `$width.focus();`; commit it on a new branch rw/jspaint/bad-fix.

npm run attest -- prove --app . --config-dir examples/realworld/jspaint-attributes-focus \
  --base rw/jspaint/base --pr rw/jspaint/fix --break rw/jspaint/bad-fix
```

Without a key, add `--replay examples/realworld/jspaint-attributes-focus/cassette.jsonl`. That replays run 1's recorded model answers; it is not a live run. `serve.cjs` is a dependency-free static server. Nothing is installed from the third-party repo, and the app gets no API keys.
