# Unsealed held-out labels

Opened on 2026-11-03 at 05:40 IST, after all 40 runs (run 1 and run 2) had finished.

- `heldout-labels-v2.zip`: the sealed bundle, byte for byte. Its SHA-256 must equal the hash in [`../SEALED.sha256`](../SEALED.sha256), which was committed before any run:
  `4ff87f0a4e740ee9965ebd15917a9a8a4eefc6514513252af21e86b54cd28489`. The bundle holds the selector's ground-truth tests, their results for every build, calibration, provenance and change history.
- `labels.json` and `human-checks.json`: copies of two files from the zip, for reading. `human-checks.json` lists three cases suggested for a person to reproduce; none has been done yet (`"performed": false`).
- Score: `node scripts/score-heldout.mjs examples/heldout/unsealed/heldout-labels-v2.zip examples/heldout/unsealed/labels.json proofs/heldout/run-1 proofs/heldout/run-2`

Some scripts in the bundle require Playwright from the selector's local checkout path; they are published unchanged so the hash still matches.
