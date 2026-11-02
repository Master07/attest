# Held-out harness — p2/b1: shortcuts while typing (impress.js)

**Bug report:** https://github.com/impress/impress.js/commit/4d3adb09cd99ce43f93703dee358f29637dddd74

**Report:** "Keyboard shortcuts activate while typing in input fields without an explicit type
attribute, and in other input types. Typing text into these fields should not activate
presentation shortcuts. Explicit text inputs must continue working, and shortcuts should work
with the slide focused."

**Project:** impress.js — https://github.com/impress/impress.js — MIT (`LICENSE` at the source
snapshot).

**Base:** `ho/p2/b1/base` — `55ad3539127a59c2053383da163d0d677671ed02`

This directory holds Attest's config and criterion only. On every ref the app is at
`examples/heldout/app`; `attest.yml` runs `serve.cjs` from here, serving that directory on
`127.0.0.1:$PORT`, and opens `/index.html`. The criterion was written from the report and the
base build only, before any candidate branch was opened.

## Reproduce

Workflow A (candidate in the Green position, no Break):

```bash
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p2-b1 --base ho/p2/b1/base --pr ho/C10/candidate --out proofs/heldout/C10-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p2-b1 --base ho/p2/b1/base --pr ho/C12/candidate --out proofs/heldout/C12-A
```

Workflow B (candidate plus this bug's separate Break build):

```bash
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p2-b1 --base ho/p2/b1/base --pr ho/C10/candidate --break ho/p2/b1/break --out proofs/heldout/C10-B
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p2-b1 --base ho/p2/b1/base --pr ho/C12/candidate --break ho/p2/b1/break --out proofs/heldout/C12-B
```

No expected verdicts are recorded in this directory.
