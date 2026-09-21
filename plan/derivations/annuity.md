# Annuity factor, 40 years at 2%

a(n, g) = (1 − (1 + g)^−n) / g

1.02^40 = 2.208040 → 1/2.208040 = 0.452890 → 1 − 0.452890 = 0.547110 → / 0.02 = **27.3555**

Used by sustainableSpend (annuitising wealth to the horizon) and by the ledger's linker pricing
(price per £1 redemption = coupon × a(n, y) + (1 + y)^−n).
