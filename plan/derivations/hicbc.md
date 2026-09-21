# High Income Child Benefit Charge and the 2026/27 rate

Rule (gov.uk, from April 2024): the charge is 1% of the Child Benefit received for every £200 of adjusted net
income above £60,000, so it is fully withdrawn at £80,000. Steps are whole: floor((ANI − 60,000)/200).

- ANI £70,000: (70,000 − 60,000)/200 = 50 steps → 50% withdrawn → **kept 0.50** of the benefit.
- ANI £60,200: exactly 1 step → **kept 0.99**.
- ANI £60,199: 0 steps → kept 1.00 (the cliff is at £60,200, not £60,001).

Rate 2026/27: eldest £27.05/week, each other child £17.90/week (April 2026 uprating of 3.8% from £26.05/£17.25).
Two children: (27.05 + 17.90) × 52 = **£2,337.40** a year.
