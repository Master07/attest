# Held-out harness — p3/b2: status after re-initialising (deck.js)

**Bug report:** https://github.com/imakewebthings/deck.js/issues/56

**Report:** "The current-slide status resets to 1 when a deck is initialized while already
positioned midway through its slides. It should show the actual slide number on initialization
and after subsequent navigation."

**Project:** deck.js — https://github.com/imakewebthings/deck.js — MIT option of the upstream
dual licence (`MIT-license.txt` at the source snapshot).

**Base:** `ho/p3/b2/base` — `1817fd6addb76259499187b22ef0646de27ea4ab`

This directory holds Attest's config and criterion only. On every ref the app is at
`examples/heldout/app`; `attest.yml` runs `serve.cjs` from here, serving that directory on
`127.0.0.1:$PORT`, and opens `/index.html`. The criterion was written from the report and the
base build only, before any candidate branch was opened.

## Reproduce

Workflow A (candidate in the Green position, no Break):

```bash
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p3-b2 --base ho/p3/b2/base --pr ho/C09/candidate --out proofs/heldout/C09-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p3-b2 --base ho/p3/b2/base --pr ho/C11/candidate --out proofs/heldout/C11-A
```

Workflow B (candidate plus this bug's separate Break build):

```bash
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p3-b2 --base ho/p3/b2/base --pr ho/C09/candidate --break ho/p3/b2/break --out proofs/heldout/C09-B
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p3-b2 --base ho/p3/b2/base --pr ho/C11/candidate --break ho/p3/b2/break --out proofs/heldout/C11-B
```

No expected verdicts are recorded in this directory.
