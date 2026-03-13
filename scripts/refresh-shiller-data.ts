/**
 * Refresh Shiller monthly data from Robert Shiller's online Excel file.
 *
 * Source: http://www.econ.yale.edu/~shiller/data/ie_data.xls
 *
 * This script:
 * 1. Downloads the latest Shiller IE data spreadsheet
 * 2. Parses monthly S&P 500 real prices, real earnings, CPI, 10yr bond rates, and CAPE
 * 3. Computes monthly real stock returns and real bond returns in basis points
 * 4. Outputs to lib/fire/ern/data/shiller-monthly.json in format [stockBps, bondBps, cape×10]
 *
 * Usage: npx tsx scripts/refresh-shiller-data.ts
 *
 * The CAPE_START_INDEX (119 = Jan 1881) should remain stable as CAPE data
 * starts from Jan 1881 in Shiller's dataset.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const SHILLER_URL = 'http://www.econ.yale.edu/~shiller/data/ie_data.xls';
const OUTPUT_PATH = path.join(__dirname, '..', 'lib', 'fire', 'ern', 'data', 'shiller-monthly.json');

interface ShillerRow {
  date: number;        // e.g., 1871.01
  sp500Real: number;   // Real S&P 500 price
  bondRate: number;    // 10yr GS10 yield (annual %)
  cpi: number;         // CPI
  cape: number;        // CAPE10 (0 before 1881)
}

async function downloadShillerData(): Promise<Buffer> {
  console.log(`Downloading Shiller data from ${SHILLER_URL}...`);
  const response = await fetch(SHILLER_URL);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function parseShillerWorkbook(buffer: Buffer): ShillerRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Data is in the first sheet, typically "Data"
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find the data start row (first row where column A is a number like 1871.01)
  const rows: ShillerRow[] = [];
  for (const row of raw) {
    const dateVal = Number(row[0]);
    if (isNaN(dateVal) || dateVal < 1870 || dateVal > 2100) continue;

    const sp500Real = Number(row[7]);  // Column H: Real Price (real S&P Comp.)
    const bondRate = Number(row[6]);   // Column G: Rate GS10 (10yr yield)
    const cpi = Number(row[5]);        // Column F: CPI
    const cape = Number(row[11]);      // Column L: CAPE10

    if (isNaN(sp500Real) || sp500Real <= 0) continue;

    rows.push({
      date: dateVal,
      sp500Real,
      bondRate: isNaN(bondRate) ? 0 : bondRate,
      cpi: isNaN(cpi) ? 0 : cpi,
      cape: isNaN(cape) ? 0 : cape,
    });
  }

  console.log(`Parsed ${rows.length} monthly rows from Shiller data`);
  return rows;
}

function computeMonthlyReturns(rows: ShillerRow[]): [number, number, number][] {
  const result: [number, number, number][] = [];

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];

    // Real stock return (month-over-month real price change)
    // Note: this is price return only; Shiller's real price already accounts for CPI
    const stockReturn = prev.sp500Real > 0
      ? (curr.sp500Real / prev.sp500Real - 1)
      : 0;

    // Real bond return approximation:
    // Monthly return ≈ (annual yield / 12) adjusted for CPI change
    // Using the 10yr yield as a proxy for monthly bond return
    const nominalBondMonthly = prev.bondRate / 100 / 12;
    const cpiChange = prev.cpi > 0 ? (curr.cpi / prev.cpi - 1) : 0;
    const realBondReturn = nominalBondMonthly - cpiChange;

    // Convert to basis points (×10000) and round
    const stockBps = Math.round(stockReturn * 10000);
    const bondBps = Math.round(realBondReturn * 10000);

    // CAPE × 10 (to store as integer, preserving 1 decimal)
    const cape10x = Math.round(curr.cape * 10);

    result.push([stockBps, bondBps, cape10x]);
  }

  return result;
}

async function main() {
  try {
    // Read existing data for comparison
    let existingLength = 0;
    if (fs.existsSync(OUTPUT_PATH)) {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
      existingLength = existing.length;
    }

    // Download and parse
    const buffer = await downloadShillerData();
    const rows = parseShillerWorkbook(buffer);
    const returns = computeMonthlyReturns(rows);

    // Validate
    if (returns.length < 1800) {
      throw new Error(`Too few data points: ${returns.length} (expected 1800+)`);
    }

    // Check CAPE starts at expected index
    const capeStartIdx = returns.findIndex(r => r[2] > 0);
    console.log(`CAPE data starts at index ${capeStartIdx} (expected 119)`);
    if (capeStartIdx !== 119) {
      console.warn(`WARNING: CAPE_START_INDEX may need updating (was 119, now ${capeStartIdx})`);
    }

    // Verify first and last values are reasonable
    console.log(`First entry: [${returns[0]}]`);
    console.log(`Last entry: [${returns[returns.length - 1]}]`);
    console.log(`Last CAPE: ${returns[returns.length - 1][2] / 10}`);

    // Write output
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(returns));
    console.log(`\nWritten ${returns.length} monthly returns to ${OUTPUT_PATH}`);
    console.log(`Previous: ${existingLength} entries, New: ${returns.length} entries (+${returns.length - existingLength})`);

  } catch (error) {
    console.error('Error refreshing Shiller data:', error);
    process.exit(1);
  }
}

main();
