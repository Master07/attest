# Benchmark results

| ID | Title | Red | Green | Break | Verdict |
|---|---|---|---|---|---|
| [G-checkout-bad-redirect](G-checkout-bad-redirect/receipt.json) | checkout: Success goes to a missing page | fail | pass | fail | **PROVEN** |
| [G-checkout-clipped](G-checkout-clipped/receipt.json) | checkout: Control clipped by its panel | pass | pass | pass | **INCONCLUSIVE** |
| [G-checkout-delayed-enable](G-checkout-delayed-enable/receipt.json) | checkout: Control disabled shortly after load | fail | pass | fail | **PROVEN** |
| [G-checkout-double-apply](G-checkout-double-apply/receipt.json) | checkout: Update applied twice | fail | pass | fail | **PROVEN** |
| [G-checkout-fixed-banner](G-checkout-fixed-banner/receipt.json) | checkout: Fixed banner covers the control | fail | pass | fail | **PROVEN** |
| [G-checkout-hidden-required](G-checkout-hidden-required/receipt.json) | checkout: Hidden required field blocks submit | fail | pass | fail | **PROVEN** |
| [G-checkout-invisible](G-checkout-invisible/receipt.json) | checkout: Control invisible | fail | pass | fail | **PROVEN** |
| [G-checkout-late-overlay](G-checkout-late-overlay/receipt.json) | checkout: Late third-party overlay | fail | pass | fail | **PROVEN** |
| [G-checkout-nan](G-checkout-nan/receipt.json) | checkout: Parsed amount becomes NaN | fail | pass | fail | **PROVEN** |
| [G-checkout-navigate-early](G-checkout-navigate-early/receipt.json) | checkout: Navigation before the save finishes | fail | pass | fail | **PROVEN** |
| [G-checkout-no-pointer](G-checkout-no-pointer/receipt.json) | checkout: Container ignores the pointer | fail | pass | fail | **PROVEN** |
| [G-checkout-offscreen](G-checkout-offscreen/receipt.json) | checkout: Control pushed off-screen | pass | pass | fail | **INCONCLUSIVE** |
| [G-checkout-prevent-default](G-checkout-prevent-default/receipt.json) | checkout: Default action prevented | fail | pass | fail | **PROVEN** |
| [G-checkout-stale-render](G-checkout-stale-render/receipt.json) | checkout: State updates but the page does not | fail | pass | fail | **PROVEN** |
| [G-checkout-transparent-overlay](G-checkout-transparent-overlay/receipt.json) | checkout: Transparent layer over the control | fail | pass | fail | **PROVEN** |
| [G-checkout-wrong-element](G-checkout-wrong-element/receipt.json) | checkout: Handler bound to the wrong element | fail | pass | fail | **PROVEN** |
| [G-checkout-wrong-endpoint](G-checkout-wrong-endpoint/receipt.json) | checkout: Request to a missing path | fail | pass | fail | **PROVEN** |
| [G-checkout-wrong-method](G-checkout-wrong-method/receipt.json) | checkout: Request uses the wrong method | fail | pass | fail | **PROVEN** |
| [G-checkout-zero-size](G-checkout-zero-size/receipt.json) | checkout: Control rendered at zero size | fail | pass | fail | **PROVEN** |

## Totals

- wrong fixes whose tests passed: 19 / 19
- Attest verdict `PROVEN`: 17 / 19
- wrong fix rejected (Break = fail): 18 / 19
- real fix accepted (Green = pass): 19 / 19
- inconclusive: 2 / 19

  - G-checkout-clipped: red: bug not reproduced in this environment; break: the wrong fix passed — the verifier cannot tell them apart
  - G-checkout-offscreen: red: bug not reproduced in this environment
