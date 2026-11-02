# Held-out harness — p2/b2: default substep ordering (impress.js)

**Bug report:** https://github.com/impress/impress.js/issues/855

**Report:** "Substeps without explicit ordering are shown or hidden as a group. Each
next/previous action should reveal/hide one default-order substep, while explicitly equal ordered
substeps should still be grouped."

**Project:** impress.js — https://github.com/impress/impress.js — MIT (`LICENSE` at the source
snapshot).

**Base:** `ho/p2/b2/base` — `60e3490a8ad2d01f5de294bd0dcf33316d73d64f`

This directory holds Attest's config and criterion only. On every ref the app is at
`examples/heldout/app`; `attest.yml` runs `serve.cjs` from here, serving that directory on
`127.0.0.1:$PORT`, and opens `/index.html`. The criterion was written from the report and the
base build only, before any candidate branch was opened.

## Reproduce

Workflow A (candidate in the Green position, no Break):

```bash
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p2-b2 --base ho/p2/b2/base --pr ho/C04/candidate --out proofs/heldout/C04-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p2-b2 --base ho/p2/b2/base --pr ho/C06/candidate --out proofs/heldout/C06-A
```

Workflow B (candidate plus this bug's separate Break build):

```bash
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p2-b2 --base ho/p2/b2/base --pr ho/C04/candidate --break ho/p2/b2/break --out proofs/heldout/C04-B
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p2-b2 --base ho/p2/b2/base --pr ho/C06/candidate --break ho/p2/b2/break --out proofs/heldout/C06-B
```

No expected verdicts are recorded in this directory.
