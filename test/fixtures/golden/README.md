# Harness golden fixtures

`test-only-ed25519.pem` is a **public TEST KEY**, generated once for these tests.
It has no identity or authority. Never use it to sign real receipts. The tests
always pass its explicit path and never read a real signing key or `.env`.

The three `*.canonical.json` files contain the exact UTF-8 signed body bytes,
without a trailing newline. They exclude the top-level `signature` and use
`canonicalJson` from `src/eventlog.ts`, as `signReceipt` does:

| Fixture | Committed receipt |
| --- | --- |
| proven.canonical.json | proofs/benchmark/run-2/B10/receipt.json |
| rejected.canonical.json | proofs/heldout/run-2/C11-A/receipt.json |
| inconclusive.canonical.json | proofs/heldout/run-1/C01-A/receipt.json |

`signing-body.json`, `signature.json`, and the tiny events, criteria, and artifact
files form a separate synthetic bundle for deterministic signing and tamper
checks. No screenshots, videos, or proof folders are copied into these fixtures.

Treat these as recorded outputs, not snapshots to regenerate after a refactor.
