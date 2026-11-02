# Held-out presentation selection

## Revision 2 — ready for pre-freeze review

The mapping was revised once, before any Attest run. The original oracle did not establish rendered visibility reliably and omitted some progression/native-editing assertions. Revision 2 uses calibrated rendered-visibility, full transition, and native focus/caret/value checks against the exact committed app trees, with positive controls and external network blocked.

This is a correction by the original selector, not independent reviewer verification. Projects, bug reports, app bytes, candidate IDs and source refs are unchanged; these are not new independent cases. The original archive and commitment remain preserved, with the old hash in git history. The active `SEALED.sha256` commits the revision-2 archive. No freeze, Attest evaluation or unsealing is authorized by this registration.

This pilot contains 12 randomized candidate IDs across six historical UI bugs in three MIT-licensed projects. It contains source refs and reports only; behavioral tests, candidate labels and source-change provenance are sealed separately. No Attest evaluations have been run for this selection.

## Scope and startup

These are browser presentation engines shown through minimal selector-authored local presentation pages. This keeps the UI reproducible but limits domain diversity. No account, network service or build step is required. Application source and licenses live at `examples/heldout/app` on each app ref.

In an isolated checkout of the requested ref, run:

```powershell
cd examples/heldout/app
node serve.cjs --port 4173
```

Open `http://127.0.0.1:4173/`. Choose a different `--port` for simultaneous builds. Node 24 and Microsoft Edge are the validated environment. The source app refs descend from repository snapshot `f94dc45b5f0255fc92daaf8de45d701bde2de2d0`; integrate the registration commit separately from those refs.

Shared runtime adaptations are identical across each bug's builds: reveal.js uses vendored MIT fitty 2.3.3 with an equivalent CommonJS-to-ESM default-export wrapper and an import map for a historical extensionless import. deck.js uses vendored MIT jQuery 1.7. The slide-status page includes upstream hash navigation and native History/hashchange feature detection. Its Initialize button restores the URL-selected slide. No criteria or ground-truth assertions are embedded in these pages.

## Projects

- **p1: reveal.js** — https://github.com/hakimel/reveal.js; MIT.
  - p1/b1 upstream base: `5b537aa8f8ddf1557c67d68efea5e0f28abfbf3c`. License: `LICENSE` at that source snapshot.
  - p1/b2 upstream base: `421da63750b3932e838efaf3bbf2c45df56f760e`. License: `LICENSE` at that source snapshot.
- **p2: impress.js** — https://github.com/impress/impress.js; MIT.
  - p2/b1 upstream base: `f6f4a36766454a46aca2853804e8d11c2baf3e1c`. License: `LICENSE` at that source snapshot.
  - p2/b2 upstream base: `d0ba7ff88474b989482e52848eac34efece4317a`. License: `LICENSE` at that source snapshot.
- **p3: deck.js** — https://github.com/imakewebthings/deck.js; MIT option of upstream dual licensing.
  - p3/b1 upstream base: `cfcc3dea767cdcab82f2e1284df6711a1bdb75d2`. License: `MIT-license.txt` at that source snapshot.
  - p3/b2 upstream base: `c4e57fb1b98cd9f4cca024ad138b3facfc036f7e`. License: `MIT-license.txt` at that source snapshot.

## Historical reports and app refs

### p1/b1

Typing a question mark in an editable field opens the keyboard-help overlay. Editable input, textarea and contenteditable fields should accept the character without opening help; the question-mark shortcut should still work when the deck has focus.

Source report: https://github.com/hakimel/reveal.js/issues/2645

- Base: `ho/p1/b1/base` — `823db3fe4efbc5275dad5f594782079a8f5879e2`.
- Break: `ho/p1/b1/break` — `ae74e4434630d7f10b7e493b7ff9377d1111563e`.

### p1/b2

In an RTL presentation with fragments, next/previous navigation may move the wrong way after the fragments. Next should reveal the fragments in order and then advance to the next slide; previous should reverse that sequence. Linear keyboard navigation should follow RTL arrow directions.

Source report: https://github.com/hakimel/reveal.js/commit/488c5c8f9427bc99199770dc927c2f1c79c1a468

- Base: `ho/p1/b2/base` — `d32e92fbf6c941e06f450efc2af3b2eb1a2e8268`.
- Break: `ho/p1/b2/break` — `5794f09b02c386b4dd9054ddee4d478a930c80ca`.

### p2/b1

Keyboard shortcuts activate while typing in input fields without an explicit type attribute, and in other input types. Typing text into these fields should not activate presentation shortcuts. Explicit text inputs must continue working, and shortcuts should work with the slide focused.

Source report: https://github.com/impress/impress.js/commit/4d3adb09cd99ce43f93703dee358f29637dddd74

- Base: `ho/p2/b1/base` — `55ad3539127a59c2053383da163d0d677671ed02`.
- Break: `ho/p2/b1/break` — `94ded357d11d0bed2ddde8c8fe0748ccb7393422`.

### p2/b2

Substeps without explicit ordering are shown or hidden as a group. Each next/previous action should reveal/hide one default-order substep, while explicitly equal ordered substeps should still be grouped.

Source report: https://github.com/impress/impress.js/issues/855

- Base: `ho/p2/b2/base` — `60e3490a8ad2d01f5de294bd0dcf33316d73d64f`.
- Break: `ho/p2/b2/break` — `c7a3d97c46541eb1c56e1b4f0f0a8d054fba4c07`.

### p3/b1

Presentation navigation responds to keyboard events from editable elements inside slides. Input, textarea and contenteditable controls should retain arrow keys for editing instead of changing slides, while keyboard navigation outside the controls must still work.

Source report: https://github.com/imakewebthings/deck.js/issues/28

- Base: `ho/p3/b1/base` — `e9fa7dc8f8a00f5375f8c433fa8ccb766a597c27`.
- Break: `ho/p3/b1/break` — `2608e58cf76c2556cab8cf161397a41c63ffecbf`.

### p3/b2

The current-slide status resets to 1 when a deck is initialized while already positioned midway through its slides. It should show the actual slide number on initialization and after subsequent navigation.

Source report: https://github.com/imakewebthings/deck.js/issues/56

- Base: `ho/p3/b2/base` — `1817fd6addb76259499187b22ef0646de27ea4ab`.
- Break: `ho/p3/b2/break` — `2c19b1b16a6da84ccdcee4ec4477262f8918a101`.

## Candidate registration

IDs were assigned by a cryptographic random shuffle before app refs were committed. Commit subjects and ref names carry no candidate labels.

- C01 → p3/b1: `ho/C01/candidate` — `0d88c20d3e8d828dde04eb7da6765651ac056362`.
- C02 → p1/b1: `ho/C02/candidate` — `e9c1ef6e388b10febe3de6e0d914561fe16232ae`.
- C03 → p1/b2: `ho/C03/candidate` — `4d5070c612897870fb86bdc68ee45e7f9c6a8747`.
- C04 → p2/b2: `ho/C04/candidate` — `708165c6a1564a95e088058bae0d22faccaf2f57`.
- C05 → p3/b1: `ho/C05/candidate` — `fcbb117f30d890a3b92177792300ffcdacf2613b`.
- C06 → p2/b2: `ho/C06/candidate` — `50f8cad4d605e668d9943f7495ec169ff9b3bb87`.
- C07 → p1/b2: `ho/C07/candidate` — `2c7463bc15d05a2ab156250dfb9fafcc4f7594e8`.
- C08 → p1/b1: `ho/C08/candidate` — `b9cb0c86453d857f7a0d4955b81717f21b66190d`.
- C09 → p3/b2: `ho/C09/candidate` — `33801dc4a83be8e674fb19f4a7eed968845ed3ef`.
- C10 → p2/b1: `ho/C10/candidate` — `2ecac8a1198b802c05a44eae2210572596854176`.
- C11 → p3/b2: `ho/C11/candidate` — `0a4720a8a1990588d888473be12ac3644fe563db`.
- C12 → p2/b1: `ho/C12/candidate` — `2379bf8bee49b27897016bf3fe8aa0b0eb1550d6`.

## Separation and limits

A fresh-context AI selector chose these cases independently of the evaluation runner and criteria author. Its coordinating context had read internal benchmark notes; those diagnoses were not passed to this selector. Label/test files are held outside the repository, with a random nonce in the commitment bundle. Shared filesystem separation is operational, not cryptographic access control. No human reproduction checks have been performed.

The revision-2 sealed bundle includes every pinned build's Microsoft Edge behavioral checks and positive controls, authored by the original selector independently of Attest, source digests, discarded setup attempts, provenance, and suggested human checks. Labels follow measured behavior, not an assumed status from upstream history. The SHA-256 commitment is in `SEALED.sha256`. A separate evaluation freeze must include the harnesses and run protocol before any Attest execution.
