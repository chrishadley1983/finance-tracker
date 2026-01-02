/**
 * AI Column Mapping Service
 *
 * Uses Claude API to analyse unknown CSV formats and suggest column mappings.
 */

import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import {
  buildColumnMappingPrompt,
  validateAIResponse,
  type AIMappingResponse,
} from './prompts/column-mapping';
import type { ColumnMapping } from '@/lib/validations/import';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result from AI column mapping analysis.
 */
export interface AIMappingResult {
  mapping: ColumnMapping;
  dateFormat: string;
  decimalSeparator: '.' | ',';
  amountStyle: 'single' | 'separate';
  confidence: number;
  reasoning: string;
  warnings: string[];
}

/**
 * Error types for AI mapping.
 */
export class AIMappingError extends Error {
  constructor(
    message: string,
    public readonly code: 'API_ERROR' | 'PARSE_ERROR' | 'INVALID_RESPONSE' | 'RATE_LIMITED' | 'TIMEOUT'
  ) {
    super(message);
    this.name = 'AIMappingError';
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const AI_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1024,
  timeout: 30000, // 30 seconds
  maxRetries: 1,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a cache key hash from headers.
 * Sorts and normalizes headers before hashing for consistent keys.
 */
export function generateHeadersHash(headers: string[]): string {
  const normalized = headers
    .map((h) => h.toLowerCase().trim())
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Parse Claude's JSON response, handling potential markdown wrapping.
 */
function parseAIResponse(text: string): unknown {
  // Remove potential markdown code blocks
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  return JSON.parse(cleaned);
}

/**
 * Convert AI response to our standard mapping format.
 */
function convertToColumnMapping(response: AIMappingResponse): ColumnMapping {
  const mapping: Partial<ColumnMapping> = {};

  // Required fields
  if (response.mapping.date) {
    mapping.date = response.mapping.date;
  }
  if (response.mapping.description) {
    mapping.description = response.mapping.description;
  }

  // Amount fields - depends on style
  if (response.amountStyle === 'single' && response.mapping.amount) {
    mapping.amount = response.mapping.amount;
  } else if (response.amountStyle === 'separate') {
    if (response.mapping.debit) mapping.debit = response.mapping.debit;
    if (response.mapping.credit) mapping.credit = response.mapping.credit;
  }

  // Optional fields
  if (response.mapping.reference) {
    mapping.reference = response.mapping.reference;
  }
  if (response.mapping.balance) {
    mapping.balance = response.mapping.balance;
  }

  return mapping as ColumnMapping;
}

/**
 * Validate that the mapping makes sense with the provided headers.
 */
function validateMappingAgainstHeaders(
  mapping: ColumnMapping,
  headers: string[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const headerSet = new Set(headers.map((h) => h.toLowerCase().trim()));

  // Check each mapped column exists in headers
  const checkColumn = (field: string, column: string | undefined) => {
    if (column && !headerSet.has(column.toLowerCase().trim())) {
      // Check if it's a case mismatch
      const match = headers.find(
        (h) => h.toLowerCase().trim() === column.toLowerCase().trim()
      );
      if (!match) {
        issues.push(`Mapped ${field} column "${column}" not found in headers`);
      }
    }
  };

  checkColumn('date', mapping.date);
  checkColumn('description', mapping.description);
  checkColumn('amount', mapping.amount);
  checkColumn('debit', mapping.debit);
  checkColumn('credit', mapping.credit);
  checkColumn('reference', mapping.reference);
  checkColumn('balance', mapping.balance);

  return { valid: issues.length === 0, issues };
}

// =============================================================================
// MAIN SERVICE
// =============================================================================

/**
 * Suggest column mapping using Claude AI.
 *
 * @param headers - CSV header row
 * @param sampleRows - First few data rows for context
 * @returns AI mapping result with confidence score
 * @throws AIMappingError on failure
 */
export async function suggestColumnMapping(
  headers: string[],
  sampleRows: string[][]
): Promise<AIMappingResult> {
  // Build the prompt
  const prompt = buildColumnMappingPrompt(headers, sampleRows);

  // Create Anthropic client
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts <= AI_CONFIG.maxRetries) {
    attempts++;

    try {
      // Call Claude API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout);

      const message = await client.messages.create({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      clearTimeout(timeoutId);

      // Extract text response
      const textContent = message.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new AIMappingError('No text response from AI', 'INVALID_RESPONSE');
      }

      // Parse JSON response
      let parsed: unknown;
      try {
        parsed = parseAIResponse(textContent.text);
      } catch {
        throw new AIMappingError(
          `Failed to parse AI response as JSON: ${textContent.text.slice(0, 200)}`,
          'PARSE_ERROR'
        );
      }

      // Validate response structure
      if (!validateAIResponse(parsed)) {
        throw new AIMappingError(
          'AI response does not match expected structure',
          'INVALID_RESPONSE'
        );
      }

      // Convert to our mapping format
      const mapping = convertToColumnMapping(parsed);

      // Validate mapping against headers
      const validation = validateMappingAgainstHeaders(mapping, headers);
      let adjustedConfidence = parsed.confidence;
      const warnings = [...parsed.warnings];

      if (!validation.valid) {
        // Lower confidence if there are mapping issues
        adjustedConfidence = Math.min(adjustedConfidence, 0.5);
        warnings.push(...validation.issues);
      }

      // Check required fields are present
      if (!mapping.date) {
        adjustedConfidence = Math.min(adjustedConfidence, 0.3);
        warnings.push('Could not identify date column');
      }
      if (!mapping.description) {
        adjustedConfidence = Math.min(adjustedConfidence, 0.3);
        warnings.push('Could not identify description column');
      }
      if (!mapping.amount && (!mapping.debit || !mapping.credit)) {
        adjustedConfidence = Math.min(adjustedConfidence, 0.3);
        warnings.push('Could not identify amount column(s)');
      }

      return {
        mapping,
        dateFormat: parsed.dateFormat,
        decimalSeparator: parsed.decimalSeparator,
        amountStyle: parsed.amountStyle,
        confidence: adjustedConfidence,
        reasoning: parsed.reasoning,
        warnings,
      };
    } catch (error) {
      lastError = error as Error;

      // Check for specific error types
      if (error instanceof AIMappingError) {
        if (error.code === 'PARSE_ERROR' && attempts <= AI_CONFIG.maxRetries) {
          // Retry on parse errors
          continue;
        }
        throw error;
      }

      if (error instanceof Anthropic.RateLimitError) {
        throw new AIMappingError(
          'AI rate limit exceeded. Please try again later.',
          'RATE_LIMITED'
        );
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIMappingError('AI request timed out', 'TIMEOUT');
      }

      // Don't retry on other errors
      break;
    }
  }

  // All retries exhausted
  throw new AIMappingError(
    `AI mapping failed: ${lastError?.message || 'Unknown error'}`,
    'API_ERROR'
  );
}

/**
 * Check if AI mapping should be triggered based on detection confidence.
 */
export function shouldUseAI(detectionConfidence: number): boolean {
  return detectionConfidence < 0.6;
}
