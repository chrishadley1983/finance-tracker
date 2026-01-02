/**
 * Column Mapping Prompt Template
 *
 * Prompt template for Claude to analyse CSV files and suggest column mappings.
 */

/**
 * Main prompt for analysing CSV column mappings.
 * Variables: {headers}, {sampleRows}
 */
export const COLUMN_MAPPING_PROMPT = `You are analysing a CSV file to identify which columns contain financial transaction data.

The CSV has the following headers:
{headers}

Here are the first 5 rows of data:
{sampleRows}

Identify which columns map to these required fields:
1. **date** - Transaction date (required)
2. **amount** - Transaction amount (required). Note if amounts are in a single column or split into debit/credit columns.
3. **description** - Transaction description/narrative (required)
4. **reference** - Reference number or transaction ID (optional)
5. **balance** - Running balance after transaction (optional)

Also identify:
- Date format used (e.g., DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY)
- Whether amounts use comma or period as decimal separator
- Whether debits are negative or in a separate column

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "mapping": {
    "date": "column_name or null",
    "description": "column_name or null",
    "amount": "column_name or null",
    "debit": "column_name or null (if separate)",
    "credit": "column_name or null (if separate)",
    "reference": "column_name or null",
    "balance": "column_name or null"
  },
  "dateFormat": "detected format string",
  "decimalSeparator": "." or ",",
  "amountStyle": "single" or "separate",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of your analysis",
  "warnings": ["any concerns about the data"]
}`;

/**
 * Format headers for the prompt.
 */
export function formatHeaders(headers: string[]): string {
  return headers.map((h, i) => `${i + 1}. "${h}"`).join('\n');
}

/**
 * Format sample rows for the prompt.
 */
export function formatSampleRows(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '(No data rows)';

  const lines: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    const values = headers.map((h, j) => `  ${h}: "${row[j] || ''}"`);
    lines.push(`Row ${i + 1}:\n${values.join('\n')}`);
  }
  return lines.join('\n\n');
}

/**
 * Build the complete prompt with data.
 */
export function buildColumnMappingPrompt(headers: string[], sampleRows: string[][]): string {
  return COLUMN_MAPPING_PROMPT
    .replace('{headers}', formatHeaders(headers))
    .replace('{sampleRows}', formatSampleRows(headers, sampleRows));
}

/**
 * Expected response structure from Claude.
 */
export interface AIMappingResponse {
  mapping: {
    date: string | null;
    description: string | null;
    amount: string | null;
    debit: string | null;
    credit: string | null;
    reference: string | null;
    balance: string | null;
  };
  dateFormat: string;
  decimalSeparator: '.' | ',';
  amountStyle: 'single' | 'separate';
  confidence: number;
  reasoning: string;
  warnings: string[];
}

/**
 * Validate the AI response has the expected structure.
 */
export function validateAIResponse(response: unknown): response is AIMappingResponse {
  if (!response || typeof response !== 'object') return false;

  const resp = response as Record<string, unknown>;

  // Check required fields
  if (!resp.mapping || typeof resp.mapping !== 'object') return false;
  if (typeof resp.dateFormat !== 'string') return false;
  if (resp.decimalSeparator !== '.' && resp.decimalSeparator !== ',') return false;
  if (resp.amountStyle !== 'single' && resp.amountStyle !== 'separate') return false;
  if (typeof resp.confidence !== 'number') return false;
  if (typeof resp.reasoning !== 'string') return false;
  if (!Array.isArray(resp.warnings)) return false;

  const mapping = resp.mapping as Record<string, unknown>;

  // Check mapping has required keys (values can be null)
  const requiredKeys = ['date', 'description', 'amount', 'debit', 'credit', 'reference', 'balance'];
  for (const key of requiredKeys) {
    if (!(key in mapping)) return false;
    const value = mapping[key];
    if (value !== null && typeof value !== 'string') return false;
  }

  return true;
}
