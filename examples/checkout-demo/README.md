# checkout-demo

A tiny checkout app used to demonstrate Attest's Red / Green / Break proof. No dependencies.

```bash
cd examples/checkout-demo
npm start            # http://localhost:4100/cart  (set PORT to change)
npm test             # unit tests, where a branch has them
```

## The bug

Customers report: *"I click Pay and nothing happens."*

## Branches

The three branches differ only inside `examples/checkout-demo/`.

| Branch | Role in the proof | What it contains |
|---|---|---|
| `demo/base` | **Red** | The reported bug |
| `demo/bad-fix` | **Break** | A plausible fix whose unit tests pass |
| `demo/fix` | **Green** | The real fix |

Run the proof from the repo root:

```bash
attest prove --app examples/checkout-demo --base demo/base --pr demo/fix --break demo/bad-fix
```

`attest.yml` tells Attest how to start the app; `criteria.yml` holds the human-approved acceptance criteria.
