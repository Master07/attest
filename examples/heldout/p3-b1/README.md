# Held-out harness — p3/b1: arrow keys in editable fields (deck.js)

**Bug report:** https://github.com/imakewebthings/deck.js/issues/28

**Report:** "Presentation navigation responds to keyboard events from editable elements inside
slides. Input, textarea and contenteditable controls should retain arrow keys for editing instead
of changing slides, while keyboard navigation outside the controls must still work."

**Project:** deck.js — https://github.com/imakewebthings/deck.js — MIT option of the upstream
dual licence (`MIT-license.txt` at the source snapshot).

**Base:** `ho/p3/b1/base` — `e9fa7dc8f8a00f5375f8c433fa8ccb766a597c27`

This directory holds Attest's config and criterion only. On every ref the app is at
`examples/heldout/app`; `attest.yml` runs `serve.cjs` from here, serving that directory on
`127.0.0.1:$PORT`, and opens `/index.html`. The criterion was written from the report and the
base build only, before any candidate branch was opened.

## Reproduce

Workflow A (candidate in the Green position, no Break):

```bash
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p3-b1 --base ho/p3/b1/base --pr ho/C01/candidate --out proofs/heldout/C01-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p3-b1 --base ho/p3/b1/base --pr ho/C05/candidate --out proofs/heldout/C05-A
```

Workflow B (candidate plus this bug's separate Break build):

```bash
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p3-b1 --base ho/p3/b1/base --pr ho/C01/candidate --break ho/p3/b1/break --out proofs/heldout/C01-B
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p3-b1 --base ho/p3/b1/base --pr ho/C05/candidate --break ho/p3/b1/break --out proofs/heldout/C05-B
```

No expected verdicts are recorded in this directory.
