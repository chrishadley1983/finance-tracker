import { ebFetch } from './client';
import type { ASPSP } from './types';

/** List the ASPSPs (banks) available for a country, e.g. "GB". */
export async function getAspsps(country: string): Promise<ASPSP[]> {
  const res = await ebFetch<{ aspsps: ASPSP[] }>(
    `/aspsps?country=${encodeURIComponent(country)}`,
  );
  return res.aspsps ?? [];
}

/** Find a single ASPSP by (case-insensitive) name within a country. */
export async function findAspsp(name: string, country: string): Promise<ASPSP | undefined> {
  const list = await getAspsps(country);
  const lc = name.toLowerCase();
  return list.find((a) => a.name.toLowerCase() === lc);
}
