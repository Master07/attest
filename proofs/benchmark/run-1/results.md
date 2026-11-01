# Benchmark results

| ID | Title | Red | Green | Break | Verdict |
|---|---|---|---|---|---|
| [B01](B01/receipt.json) | Pay button stays disabled | fail | pass | fail | **PROVEN** |
| [B02](B02/receipt.json) | Redirect after payment goes to a 404 | inconclusive | pass | inconclusive | **INCONCLUSIVE** |
| [B03](B03/receipt.json) | Discount applied twice | fail | pass | fail | **PROVEN** |
| [B04](B04/receipt.json) | Pay button is off-screen on desktop | inconclusive | pass | fail | **INCONCLUSIVE** |
| [B05](B05/receipt.json) | Email pattern blocks normal addresses | fail | pass | inconclusive | **INCONCLUSIVE** |
| [B06](B06/receipt.json) | Cookie banner covers Pay and never closes | fail | pass | fail | **PROVEN** |
| [B07](B07/receipt.json) | Payment posts to an endpoint that does not exist | fail | pass | fail | **PROVEN** |
| [B08](B08/receipt.json) | Pay button is invisible after the cart renders | inconclusive | pass | fail | **INCONCLUSIVE** |
| [B09](B09/receipt.json) | Third-party chat widget covers Pay | fail | pass | inconclusive | **INCONCLUSIVE** |
| [B10](B10/receipt.json) | Total parses to NaN so Pay does nothing | fail | pass | inconclusive | **INCONCLUSIVE** |

## Totals

- wrong fixes whose unit tests passed: 10 / 10
  - *Note added 2026-11-01, not part of the script's output:* 6 of these are unit tests; for B04, B06, B08 and B09 the test is a source check (CSS or HTML) — the only test you can write without a browser.
- Attest verdict `PROVEN`: 4 / 10
- wrong fix rejected (Break = fail): 6 / 10
- real fix accepted (Green = pass): 10 / 10
- inconclusive: 6 / 10

  - B02: red: inconclusive; break: inconclusive
  - B04: red: inconclusive
  - B05: break: inconclusive
  - B08: red: inconclusive
  - B09: break: inconclusive
  - B10: break: inconclusive
