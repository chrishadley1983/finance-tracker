export const gbp = (n: number, dp = 0) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: dp, minimumFractionDigits: 0 });

export const gbpK = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}M` : `£${Math.round(n / 1000)}k`;
