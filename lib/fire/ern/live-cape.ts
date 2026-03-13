/**
 * Live CAPE ratio utility.
 *
 * Reads the latest CAPE from the Shiller monthly data (already in the JSON).
 * The data is refreshed by running `npx tsx scripts/refresh-shiller-data.ts`.
 *
 * Falls back to a reasonable default if the last entry has no CAPE data.
 */

import { getDataLength, getCape } from './data';

/** Default CAPE if data is unavailable */
const DEFAULT_CAPE = 39;

/**
 * Get the most recent CAPE ratio from the Shiller dataset.
 *
 * Scans backwards from the last entry to find the most recent non-zero CAPE.
 * This handles the case where the very last month may not yet have CAPE computed.
 *
 * @returns The latest CAPE ratio from the dataset
 */
export function getLatestCape(): number {
  const len = getDataLength();

  // Scan backwards for the most recent non-zero CAPE
  for (let i = len - 1; i >= 0; i--) {
    const cape = getCape(i);
    if (cape > 0) return cape;
  }

  return DEFAULT_CAPE;
}

/**
 * Get the data vintage (approximate date of last entry).
 *
 * Based on 1861 entries starting from 1871-01, each entry = 1 month.
 * Last entry index = length - 1, corresponding to 1871-01 + (length-1) months.
 *
 * @returns Approximate date string (YYYY-MM) of the last data point
 */
export function getDataVintage(): string {
  const len = getDataLength();
  const startYear = 1871;
  const startMonth = 1; // January

  const totalMonths = startYear * 12 + (startMonth - 1) + len;
  // First entry is index 0 = 1871-02 (return from Jan to Feb)
  // Actually: returns are computed from consecutive months, so
  // index 0 = return for 1871-02 (Feb 1871), last = 1871-01 + len months
  const endYear = Math.floor(totalMonths / 12);
  const endMonth = (totalMonths % 12) + 1;

  return `${endYear}-${String(endMonth).padStart(2, '0')}`;
}
