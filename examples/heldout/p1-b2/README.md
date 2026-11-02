# Held-out harness — p1/b2: RTL fragment navigation (reveal.js)

**Bug report:** https://github.com/hakimel/reveal.js/commit/488c5c8f9427bc99199770dc927c2f1c79c1a468

**Report:** "In an RTL presentation with fragments, next/previous navigation may move the wrong
way after the fragments. Next should reveal the fragments in order and then advance to the next
slide; previous should reverse that sequence. Linear keyboard navigation should follow RTL arrow
directions."

**Project:** reveal.js — https://github.com/hakimel/reveal.js — MIT (`LICENSE` at the source
snapshot).

**Base:** `ho/p1/b2/base` — `d32e92fbf6c941e06f450efc2af3b2eb1a2e8268`

This directory holds Attest's config and criterion only. On every ref the app is at
`examples/heldout/app`; `attest.yml` runs `serve.cjs` from here, serving that directory on
`127.0.0.1:$PORT`, and opens `/index.html`. The criterion was written from the report and the
base build only, before any candidate branch was opened.

## Reproduce

Workflow A (candidate in the Green position, no Break):

```bash
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p1-b2 --base ho/p1/b2/base --pr ho/C03/candidate --out proofs/heldout/C03-A
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p1-b2 --base ho/p1/b2/base --pr ho/C07/candidate --out proofs/heldout/C07-A
```

Workflow B (candidate plus this bug's separate Break build):

```bash
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p1-b2 --base ho/p1/b2/base --pr ho/C03/candidate --break ho/p1/b2/break --out proofs/heldout/C03-B
npm run attest -- prove --app examples/heldout/app --config-dir examples/heldout/p1-b2 --base ho/p1/b2/base --pr ho/C07/candidate --break ho/p1/b2/break --out proofs/heldout/C07-B
```

No expected verdicts are recorded in this directory.
