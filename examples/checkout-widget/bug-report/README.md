# Sample bug report

Input for `attest draft`, which turns a screen recording and/or spoken narration into **draft** acceptance criteria for a person to review.

| File | What it is |
|---|---|
| `bug.webm` | A screen recording of the bug (captured by Attest's browser on `demo2/base`, so no mouse cursor is drawn) |
| `narration.wav` | The "customer" describing the bug. **Synthetic**: generated with Windows' built-in speech engine as test data, 22 kHz mono — Attest converts it to the 16 kHz Muse Voice Transcribe accepts |
| `criteria.draft.yml` | The draft Muse Spark 1.3 produced from the two files above, unedited |

```bash
npm run attest -- draft --video examples/checkout-widget/bug-report/bug.webm --audio examples/checkout-widget/bug-report/narration.wav --out my-draft.yml
```

Spark only accepts MP4 video; WebM and other formats are re-encoded to MP4 in the browser first. Phone and screen-recorder clips are usually MP4 already.

The unedited draft above was used in a live proof of `demo2/base` → `demo2/fix` → `demo2/bad-fix` and returned **PROVEN** (Spark, SAM 3.1 and the judge agreeing in every phase; code checks were n/a because the draft does not guess URLs).
