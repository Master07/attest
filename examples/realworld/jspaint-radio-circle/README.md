# Real-world proof: a maintainer's fix — clicking the radio circle in JS Paint's Flip/Rotate did nothing

The app: [1j01/jspaint](https://github.com/1j01/jspaint) (MIT licence, © 2022 Isaiah Odhner) — JS Paint, static files, no build. Credit to its author. **A fix written by a person**, reported in its own row next to the AI-agent proofs.

The bug: issues [#311](https://github.com/1j01/jspaint/issues/311) "Unable to Flip Vertical" and [#312](https://github.com/1j01/jspaint/issues/312) "Unable to Rotate By Angle" — in the Classic theme the round radio is drawn by a `label::before` with `pointer-events: none`, so a click on the circle misses. The fix: [`98bc205`](https://github.com/1j01/jspaint/commit/98bc20554d97b82f2eae8ee2ad0cea3a7783503f) by Isaiah Odhner, "Fix clicking radio buttons directly…".

| Ref | Commit | What it is |
|---|---|---|
| base (Red) | [`00715fb`](https://github.com/1j01/jspaint/commit/00715fb5e506af5a18920a3aa329dc866e50145a) | The fix's parent — has the bug |
| fix (Green) | [`98bc205`](https://github.com/1j01/jspaint/commit/98bc20554d97b82f2eae8ee2ad0cea3a7783503f) | `input[type="radio"] + label::before { pointer-events: all }` |
| bad-fix (Break) | local commit on top of the fix | A plausible wrong fix **we wrote**: the same rule only for `:checked` radios, so the unselected circle you click is still dead |

**Hand check** (Ctrl+Alt+R on a blank image, click the circle 18 px left of the words "Flip vertical"):

| Tree | Element under the click | Selected after the click |
|---|---|---|
| base | `div.radio-wrapper` | Flip horizontal (unchanged) |
| fix | the label | **Flip vertical** |
| bad-fix (ours) | `div.radio-wrapper` | Flip horizontal (unchanged) |

Clicking the **words** works on base too, which is why the criterion names the circle. The Classic theme is the default outside December.

**Found by** a search for small, permissively licensed web apps with a public bug report and a public fix (research agent), then **hand-checked by us** before this commit (Edge, 1280×720, real mouse and keyboard, state read from the page, screenshots compared).

## Runs

Each run is reported here whatever its verdict; a re-run would be numbered and reported too.

| # | Criteria | Change before the run | Red | Green | Break | Verdict | Receipt |
|---|---|---|---|---|---|---|---|
| 1 | `criteria.yml` (frozen in `532408f`, with the wrong fix) | none | fail | pass | fail | **PROVEN** | [proofs/realworld/jspaint-311-run1](../../../proofs/realworld/jspaint-311-run1/) |

**Run 1, live, first attempt: PROVEN.** Red (the PR's parent): *"Clicked the small radio circle for Flip vertical twice and Flip horizontal remained selected."* Green (the maintainer's fix): *"Clicked the small radio circle for Flip vertical and the dot moved."* Break (ours: the rule only on the checked radio): *"After clicking the small radio circle for Flip vertical twice, Flip horizontal remained selected."* The judge agreed in every phase.

The click log shows why. The verifier clicked the same spot, about (504, 341), in every phase. On the parent and on our wrong fix the click landed on the `div.radio-wrapper` behind the circle; on the fix it landed on the `label` that draws the circle. In Break the verifier then clicked the label's text at (556, 341), which does select the option; the judge saw that in frame 6 and still failed the phase, because the criterion is about clicking the circle itself.

The code checks and SAM had nothing to check (the criterion names no URL, network call or on-screen element) and abstained, so each phase rests on the verifier (Muse Spark 1.3, computer use) and the independent judge (Muse Spark Open on Baseten, screenshots only) agreeing.

**What this shows, and what it doesn't.** The maintainer's fix makes the circle clickable, and Attest rejects a fix that only works for the circle that's already selected. This fix was written by a person; it is reported with the AI-agent proofs but labelled separately. The wrong fix is ours, labelled, and committed before the run.

## Reproduce

```bash
git fetch --depth 1 https://github.com/1j01/jspaint 00715fb5e506af5a18920a3aa329dc866e50145a:refs/heads/rw/jsp311/base
git fetch --depth 1 https://github.com/1j01/jspaint 98bc20554d97b82f2eae8ee2ad0cea3a7783503f:refs/heads/rw/jsp311/fix
# bad-fix: from the fix, in styles/layout.css change `input[type="radio"] + label::before {` to `input[type="radio"]:checked + label::before {`; commit it on a new branch rw/jsp311/bad-fix.

npm run attest -- prove --app . --config-dir examples/realworld/jspaint-radio-circle \
  --base rw/jsp311/base --pr rw/jsp311/fix --break rw/jsp311/bad-fix
```

`attest.yml` serves the checked-out tree with `serve.cjs` (a dependency-free static server kept here). Nothing is installed from the third-party repo, and the app gets no API keys.
