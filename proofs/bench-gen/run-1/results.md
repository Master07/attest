# Benchmark results

| ID | Title | Red | Green | Break | Verdict |
|---|---|---|---|---|---|
| [G-checkout-bad-redirect](G-checkout-bad-redirect/receipt.json) | checkout: Success goes to a missing page | fail | pass | fail | **PROVEN** |
| [G-checkout-clipped](G-checkout-clipped/receipt.json) | checkout: Control clipped by its panel | inconclusive | pass | pass | **INCONCLUSIVE** |
| [G-checkout-delayed-enable](G-checkout-delayed-enable/receipt.json) | checkout: Control disabled shortly after load | fail | inconclusive | fail | **INCONCLUSIVE** |
| [G-checkout-double-apply](G-checkout-double-apply/receipt.json) | checkout: Update applied twice | fail | pass | fail | **PROVEN** |
| [G-checkout-fixed-banner](G-checkout-fixed-banner/receipt.json) | checkout: Fixed banner covers the control | inconclusive | inconclusive | inconclusive | **INCONCLUSIVE** |
| [G-checkout-hidden-required](G-checkout-hidden-required/receipt.json) | checkout: Hidden required field blocks submit | fail | inconclusive | fail | **INCONCLUSIVE** |
| [G-checkout-invisible](G-checkout-invisible/receipt.json) | checkout: Control invisible | fail | inconclusive | fail | **INCONCLUSIVE** |
| [G-checkout-late-overlay](G-checkout-late-overlay/receipt.json) | checkout: Late third-party overlay | fail | pass | fail | **PROVEN** |
| [G-checkout-nan](G-checkout-nan/receipt.json) | checkout: Parsed amount becomes NaN | fail | inconclusive | fail | **INCONCLUSIVE** |
| [G-checkout-navigate-early](G-checkout-navigate-early/receipt.json) | checkout: Navigation before the save finishes | fail | pass | fail | **PROVEN** |
| [G-checkout-no-pointer](G-checkout-no-pointer/receipt.json) | checkout: Container ignores the pointer | fail | pass | fail | **PROVEN** |
| [G-checkout-offscreen](G-checkout-offscreen/receipt.json) | checkout: Control pushed off-screen | pass | pass | pass | **INCONCLUSIVE** |
| [G-checkout-prevent-default](G-checkout-prevent-default/receipt.json) | checkout: Default action prevented | fail | inconclusive | fail | **INCONCLUSIVE** |
| [G-checkout-stale-render](G-checkout-stale-render/receipt.json) | checkout: State updates but the page does not | fail | pass | fail | **PROVEN** |
| [G-checkout-string-compare](G-checkout-string-compare/receipt.json) | checkout: Action disabled by a type mismatch | fail | inconclusive | fail | **INCONCLUSIVE** |
| [G-checkout-transparent-overlay](G-checkout-transparent-overlay/receipt.json) | checkout: Transparent layer over the control | fail | inconclusive | fail | **INCONCLUSIVE** |
| [G-checkout-wrong-element](G-checkout-wrong-element/receipt.json) | checkout: Handler bound to the wrong element | fail | pass | fail | **PROVEN** |
| [G-checkout-wrong-endpoint](G-checkout-wrong-endpoint/receipt.json) | checkout: Request to a missing path | fail | inconclusive | fail | **INCONCLUSIVE** |
| [G-checkout-wrong-method](G-checkout-wrong-method/receipt.json) | checkout: Request uses the wrong method | fail | pass | fail | **PROVEN** |
| [G-checkout-zero-size](G-checkout-zero-size/receipt.json) | checkout: Control rendered at zero size | inconclusive | inconclusive | fail | **INCONCLUSIVE** |
| [G-search-bad-redirect](G-search-bad-redirect/receipt.json) | search: Success goes to a missing page | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-search-clipped](G-search-clipped/receipt.json) | search: Control clipped by its panel | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-search-delayed-enable](G-search-delayed-enable/receipt.json) | search: Control disabled shortly after load | fail | pass | fail | **PROVEN** |
| [G-search-double-apply](G-search-double-apply/receipt.json) | search: Update applied twice | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-search-fixed-banner](G-search-fixed-banner/receipt.json) | search: Fixed banner covers the control | fail | pass | fail | **PROVEN** |
| [G-search-hidden-required](G-search-hidden-required/receipt.json) | search: Hidden required field blocks submit | fail | pass | fail | **PROVEN** |
| [G-search-invisible](G-search-invisible/receipt.json) | search: Control invisible | pass | pass | pass | **INCONCLUSIVE** |
| [G-search-late-overlay](G-search-late-overlay/receipt.json) | search: Late third-party overlay | pass | pass | fail | **INCONCLUSIVE** |
| [G-search-nan](G-search-nan/receipt.json) | search: Parsed amount becomes NaN | fail | pass | fail | **PROVEN** |
| [G-search-navigate-early](G-search-navigate-early/receipt.json) | search: Navigation before the save finishes | fail | pass | fail | **PROVEN** |
| [G-search-no-pointer](G-search-no-pointer/receipt.json) | search: Container ignores the pointer | pass | pass | pass | **INCONCLUSIVE** |
| [G-search-offscreen](G-search-offscreen/receipt.json) | search: Control pushed off-screen | pass | pass | pass | **INCONCLUSIVE** |
| [G-search-prevent-default](G-search-prevent-default/receipt.json) | search: Default action prevented | fail | pass | fail | **PROVEN** |
| [G-search-stale-render](G-search-stale-render/receipt.json) | search: State updates but the page does not | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-search-strict-pattern](G-search-strict-pattern/receipt.json) | search: Over-strict input pattern | fail | pass | fail | **PROVEN** |
| [G-search-string-compare](G-search-string-compare/receipt.json) | search: Action disabled by a type mismatch | fail | pass | fail | **PROVEN** |
| [G-search-transparent-overlay](G-search-transparent-overlay/receipt.json) | search: Transparent layer over the control | fail | pass | pass | **INCONCLUSIVE** |
| [G-search-wrong-element](G-search-wrong-element/receipt.json) | search: Handler bound to the wrong element | fail | pass | fail | **PROVEN** |
| [G-search-wrong-endpoint](G-search-wrong-endpoint/receipt.json) | search: Request to a missing path | fail | pass | fail | **PROVEN** |
| [G-search-wrong-method](G-search-wrong-method/receipt.json) | search: Request uses the wrong method | fail | pass | fail | **PROVEN** |
| [G-search-zero-size](G-search-zero-size/receipt.json) | search: Control rendered at zero size | pass | pass | pass | **INCONCLUSIVE** |
| [G-settings-bad-redirect](G-settings-bad-redirect/receipt.json) | settings: Success goes to a missing page | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-settings-clipped](G-settings-clipped/receipt.json) | settings: Control clipped by its panel | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-settings-delayed-enable](G-settings-delayed-enable/receipt.json) | settings: Control disabled shortly after load | fail | pass | fail | **PROVEN** |
| [G-settings-double-apply](G-settings-double-apply/receipt.json) | settings: Update applied twice | fail | pass | fail | **PROVEN** |
| [G-settings-fixed-banner](G-settings-fixed-banner/receipt.json) | settings: Fixed banner covers the control | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-settings-hidden-required](G-settings-hidden-required/receipt.json) | settings: Hidden required field blocks submit | fail | pass | fail | **PROVEN** |
| [G-settings-invisible](G-settings-invisible/receipt.json) | settings: Control invisible | fail | pass | fail | **PROVEN** |
| [G-settings-late-overlay](G-settings-late-overlay/receipt.json) | settings: Late third-party overlay | fail | pass | pass | **INCONCLUSIVE** |
| [G-settings-nan](G-settings-nan/receipt.json) | settings: Parsed amount becomes NaN | fail | pass | fail | **PROVEN** |
| [G-settings-navigate-early](G-settings-navigate-early/receipt.json) | settings: Navigation before the save finishes | fail | pass | fail | **PROVEN** |
| [G-settings-no-pointer](G-settings-no-pointer/receipt.json) | settings: Container ignores the pointer | inconclusive | pass | fail | **INCONCLUSIVE** |
| [G-settings-offscreen](G-settings-offscreen/receipt.json) | settings: Control pushed off-screen | inconclusive | pass | pass | **INCONCLUSIVE** |
| [G-settings-prevent-default](G-settings-prevent-default/receipt.json) | settings: Default action prevented | fail | pass | fail | **PROVEN** |
| [G-settings-stale-render](G-settings-stale-render/receipt.json) | settings: State updates but the page does not | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-settings-string-compare](G-settings-string-compare/receipt.json) | settings: Action disabled by a type mismatch | fail | pass | fail | **PROVEN** |
| [G-settings-transparent-overlay](G-settings-transparent-overlay/receipt.json) | settings: Transparent layer over the control | fail | pass | fail | **PROVEN** |
| [G-settings-wrong-element](G-settings-wrong-element/receipt.json) | settings: Handler bound to the wrong element | fail | pass | fail | **PROVEN** |
| [G-settings-wrong-endpoint](G-settings-wrong-endpoint/receipt.json) | settings: Request to a missing path | fail | pass | fail | **PROVEN** |
| [G-settings-wrong-method](G-settings-wrong-method/receipt.json) | settings: Request uses the wrong method | fail | pass | fail | **PROVEN** |
| [G-settings-zero-size](G-settings-zero-size/receipt.json) | settings: Control rendered at zero size | inconclusive | pass | fail | **INCONCLUSIVE** |
| [G-signup-bad-redirect](G-signup-bad-redirect/receipt.json) | signup: Success goes to a missing page | fail | pass | fail | **PROVEN** |
| [G-signup-clipped](G-signup-clipped/receipt.json) | signup: Control clipped by its panel | pass | pass | pass | **INCONCLUSIVE** |
| [G-signup-delayed-enable](G-signup-delayed-enable/receipt.json) | signup: Control disabled shortly after load | fail | pass | fail | **PROVEN** |
| [G-signup-double-apply](G-signup-double-apply/receipt.json) | signup: Update applied twice | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-signup-fixed-banner](G-signup-fixed-banner/receipt.json) | signup: Fixed banner covers the control | fail | pass | inconclusive | **INCONCLUSIVE** |
| [G-signup-hidden-required](G-signup-hidden-required/receipt.json) | signup: Hidden required field blocks submit | fail | pass | fail | **PROVEN** |
| [G-signup-invisible](G-signup-invisible/receipt.json) | signup: Control invisible | fail | pass | inconclusive | **INCONCLUSIVE** |
| [G-signup-late-overlay](G-signup-late-overlay/receipt.json) | signup: Late third-party overlay | fail | pass | inconclusive | **INCONCLUSIVE** |
| [G-signup-nan](G-signup-nan/receipt.json) | signup: Parsed amount becomes NaN | fail | pass | fail | **PROVEN** |
| [G-signup-navigate-early](G-signup-navigate-early/receipt.json) | signup: Navigation before the save finishes | fail | pass | fail | **PROVEN** |
| [G-signup-no-pointer](G-signup-no-pointer/receipt.json) | signup: Container ignores the pointer | inconclusive | pass | fail | **INCONCLUSIVE** |
| [G-signup-offscreen](G-signup-offscreen/receipt.json) | signup: Control pushed off-screen | pass | pass | pass | **INCONCLUSIVE** |
| [G-signup-prevent-default](G-signup-prevent-default/receipt.json) | signup: Default action prevented | fail | pass | fail | **PROVEN** |
| [G-signup-stale-render](G-signup-stale-render/receipt.json) | signup: State updates but the page does not | fail | pass | inconclusive | **INCONCLUSIVE** |
| [G-signup-string-compare](G-signup-string-compare/receipt.json) | signup: Action disabled by a type mismatch | fail | pass | fail | **PROVEN** |
| [G-signup-transparent-overlay](G-signup-transparent-overlay/receipt.json) | signup: Transparent layer over the control | fail | pass | fail | **PROVEN** |
| [G-signup-wrong-element](G-signup-wrong-element/receipt.json) | signup: Handler bound to the wrong element | fail | pass | fail | **PROVEN** |
| [G-signup-wrong-endpoint](G-signup-wrong-endpoint/receipt.json) | signup: Request to a missing path | fail | pass | fail | **PROVEN** |
| [G-signup-wrong-method](G-signup-wrong-method/receipt.json) | signup: Request uses the wrong method | fail | pass | fail | **PROVEN** |
| [G-signup-zero-size](G-signup-zero-size/receipt.json) | signup: Control rendered at zero size | pass | pass | inconclusive | **INCONCLUSIVE** |
| [G-todo-bad-redirect](G-todo-bad-redirect/receipt.json) | todo: Success goes to a missing page | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-todo-clipped](G-todo-clipped/receipt.json) | todo: Control clipped by its panel | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-todo-delayed-enable](G-todo-delayed-enable/receipt.json) | todo: Control disabled shortly after load | fail | pass | fail | **PROVEN** |
| [G-todo-double-apply](G-todo-double-apply/receipt.json) | todo: Update applied twice | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-todo-fixed-banner](G-todo-fixed-banner/receipt.json) | todo: Fixed banner covers the control | fail | pass | fail | **PROVEN** |
| [G-todo-hidden-required](G-todo-hidden-required/receipt.json) | todo: Hidden required field blocks submit | fail | pass | fail | **PROVEN** |
| [G-todo-invisible](G-todo-invisible/receipt.json) | todo: Control invisible | inconclusive | pass | fail | **INCONCLUSIVE** |
| [G-todo-late-overlay](G-todo-late-overlay/receipt.json) | todo: Late third-party overlay | inconclusive | pass | fail | **INCONCLUSIVE** |
| [G-todo-nan](G-todo-nan/receipt.json) | todo: Parsed amount becomes NaN | fail | pass | fail | **PROVEN** |
| [G-todo-navigate-early](G-todo-navigate-early/receipt.json) | todo: Navigation before the save finishes | fail | pass | fail | **PROVEN** |
| [G-todo-no-pointer](G-todo-no-pointer/receipt.json) | todo: Container ignores the pointer | fail | pass | fail | **PROVEN** |
| [G-todo-offscreen](G-todo-offscreen/receipt.json) | todo: Control pushed off-screen | pass | pass | pass | **INCONCLUSIVE** |
| [G-todo-prevent-default](G-todo-prevent-default/receipt.json) | todo: Default action prevented | fail | pass | fail | **PROVEN** |
| [G-todo-stale-render](G-todo-stale-render/receipt.json) | todo: State updates but the page does not | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [G-todo-strict-pattern](G-todo-strict-pattern/receipt.json) | todo: Over-strict input pattern | fail | pass | fail | **PROVEN** |
| [G-todo-string-compare](G-todo-string-compare/receipt.json) | todo: Action disabled by a type mismatch | fail | pass | fail | **PROVEN** |
| [G-todo-transparent-overlay](G-todo-transparent-overlay/receipt.json) | todo: Transparent layer over the control | fail | pass | fail | **PROVEN** |
| [G-todo-wrong-element](G-todo-wrong-element/receipt.json) | todo: Handler bound to the wrong element | fail | pass | fail | **PROVEN** |
| [G-todo-wrong-endpoint](G-todo-wrong-endpoint/receipt.json) | todo: Request to a missing path | fail | pass | fail | **PROVEN** |
| [G-todo-wrong-method](G-todo-wrong-method/receipt.json) | todo: Request uses the wrong method | fail | pass | fail | **PROVEN** |
| [G-todo-zero-size](G-todo-zero-size/receipt.json) | todo: Control rendered at zero size | fail | pass | inconclusive | **INCONCLUSIVE** |

## Totals

- wrong fixes whose tests passed: 102 / 102
- Attest verdict `PROVEN`: 55 / 102
- wrong fix rejected (Break = fail): 70 / 102
- real fix accepted (Green = pass): 92 / 102
- inconclusive: 47 / 102

  - G-checkout-clipped: red: inconclusive; break: the wrong fix passed — the verifier cannot tell them apart
  - G-checkout-delayed-enable: green: inconclusive
  - G-checkout-fixed-banner: green: inconclusive; red: inconclusive; break: inconclusive
  - G-checkout-hidden-required: green: inconclusive
  - G-checkout-invisible: green: inconclusive
  - G-checkout-nan: green: inconclusive
  - G-checkout-offscreen: red: bug not reproduced in this environment; break: the wrong fix passed — the verifier cannot tell them apart
  - G-checkout-prevent-default: green: inconclusive
  - G-checkout-string-compare: green: inconclusive
  - G-checkout-transparent-overlay: green: inconclusive
  - G-checkout-wrong-endpoint: green: inconclusive
  - G-checkout-zero-size: green: inconclusive; red: inconclusive
  - G-search-bad-redirect: red: inconclusive; break: inconclusive
  - G-search-clipped: red: inconclusive; break: inconclusive
  - G-search-double-apply: red: inconclusive; break: inconclusive
  - G-search-invisible: red: bug not reproduced in this environment; break: the wrong fix passed — the verifier cannot tell them apart
  - G-search-late-overlay: red: bug not reproduced in this environment
  - G-search-no-pointer: red: bug not reproduced in this environment; break: the wrong fix passed — the verifier cannot tell them apart
  - G-search-offscreen: red: bug not reproduced in this environment; break: the wrong fix passed — the verifier cannot tell them apart
  - G-search-stale-render: red: inconclusive; break: inconclusive
  - G-search-transparent-overlay: break: the wrong fix passed — the verifier cannot tell them apart
  - G-search-zero-size: red: bug not reproduced in this environment; break: the wrong fix passed — the verifier cannot tell them apart
  - G-settings-bad-redirect: red: inconclusive; break: inconclusive
  - G-settings-clipped: red: inconclusive; break: inconclusive
  - G-settings-fixed-banner: red: inconclusive; break: inconclusive
  - G-settings-late-overlay: break: the wrong fix passed — the verifier cannot tell them apart
  - G-settings-no-pointer: red: inconclusive
  - G-settings-offscreen: red: inconclusive; break: the wrong fix passed — the verifier cannot tell them apart
  - G-settings-stale-render: red: inconclusive; break: inconclusive
  - G-settings-zero-size: red: inconclusive
  - G-signup-clipped: red: bug not reproduced in this environment; break: the wrong fix passed — the verifier cannot tell them apart
  - G-signup-double-apply: red: inconclusive; break: inconclusive
  - G-signup-fixed-banner: break: inconclusive
  - G-signup-invisible: break: inconclusive
  - G-signup-late-overlay: break: inconclusive
  - G-signup-no-pointer: red: inconclusive
  - G-signup-offscreen: red: bug not reproduced in this environment; break: the wrong fix passed — the verifier cannot tell them apart
  - G-signup-stale-render: break: inconclusive
  - G-signup-zero-size: red: bug not reproduced in this environment; break: inconclusive
  - G-todo-bad-redirect: red: inconclusive; break: inconclusive
  - G-todo-clipped: red: inconclusive; break: inconclusive
  - G-todo-double-apply: red: inconclusive; break: inconclusive
  - G-todo-invisible: red: inconclusive
  - G-todo-late-overlay: red: inconclusive
  - G-todo-offscreen: red: bug not reproduced in this environment; break: the wrong fix passed — the verifier cannot tell them apart
  - G-todo-stale-render: red: inconclusive; break: inconclusive
  - G-todo-zero-size: break: inconclusive
