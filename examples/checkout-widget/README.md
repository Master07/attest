# checkout-widget

The same tiny checkout app as `checkout-demo`, with a different, runtime-only bug. Used as Attest's second demo. No dependencies.

```bash
cd examples/checkout-widget
npm start            # http://localhost:4100/cart  (set PORT to change)
npm test             # the branch's tests, where it has them (demo2/bad-fix: a CSS source check)
```

## The bug

Customers report: *"I click Pay and nothing happens."*

## Branches

The three branches differ only inside `examples/checkout-widget/`.

| Branch | Role in the proof |
|---|---|
| `demo2/base` | **Red** — the reported bug |
| `demo2/bad-fix` | **Break** — a plausible fix whose test passes (it checks the CSS for a `z-index`, not the click) |
| `demo2/fix` | **Green** — the real fix |

```bash
npm run attest -- prove --app examples/checkout-widget --base demo2/base --pr demo2/fix --break demo2/bad-fix
npm run attest -- loop  --app examples/checkout-widget --base demo2/base --break demo2/bad-fix --report "I click Pay and nothing happens."
```

`public/vendor/helpbubble.min.js` stands in for a third-party support-chat snippet. It is not real vendor code.
