# Benchmark results

| ID | Title | Red | Green | Break | Verdict |
|---|---|---|---|---|---|
| [B02](B02/receipt.json) | Redirect after payment goes to a 404 | inconclusive | pass | fail | **INCONCLUSIVE** |
| [B04](B04/receipt.json) | Pay button is off-screen on desktop | fail | pass | inconclusive | **INCONCLUSIVE** |
| [B05](B05/receipt.json) | Email pattern blocks normal addresses | fail | pass | fail | **PROVEN** |
| [B08](B08/receipt.json) | Pay button is invisible after the cart renders | fail | pass | fail | **PROVEN** |
| [B09](B09/receipt.json) | Third-party chat widget covers Pay | fail | pass | fail | **PROVEN** |
| [B10](B10/receipt.json) | Total parses to NaN so Pay does nothing | fail | pass | fail | **PROVEN** |

## Totals

- wrong fixes whose unit tests passed: 6 / 6
  - *Note added 2026-11-01, not part of the script's output:* 3 of these are unit tests; for B04, B08 and B09 the test is a source check (CSS or HTML) — the only test you can write without a browser.
- Attest verdict `PROVEN`: 4 / 6
- wrong fix rejected (Break = fail): 5 / 6
- real fix accepted (Green = pass): 6 / 6
- inconclusive: 2 / 6

  - B02: red: inconclusive
  - B04: break: inconclusive
