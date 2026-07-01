/**
 * Merchant Normaliser
 *
 * Bank descriptors bury the merchant in payment-processor prefixes, order
 * references, FX-rate suffixes and location tails:
 *
 *   "INT'L 0088890845 ANTHROPIC* CLAUDE ANTHROPIC.COM"
 *   "AMAZON* NQ70H8U14 - Markers"
 *   "ZETTLE_*CABLE 8 LTLONDON"
 *   "OK Hoezaar ZEGGE EUR 3.55 @ 1.1525 Visa Rate )))"
 *
 * normaliseDescription() strips that noise; merchantKey() reduces the result
 * to a short canonical key used for rule matching, rule mining, correction
 * grouping and AI caching.
 */

// Payment-processor / POS prefixes that precede the real merchant name.
// Order matters: longer, more specific prefixes first.
const PROCESSOR_PREFIXES = [
  /^int'?l\s+\d+\s+/i, // INT'L 0088890845 …
  /^zettle_?\s*\*\s*/i, // ZETTLE_*… / Zettle *…
  /^sumup\s*\*\s*/i, // SumUp *…
  /^sq\s*\*\s*/i, // SQ *… (Square)
  /^sp\s+/i, // SP … (SumPup/Stripe descriptor)
  /^tst[-*]\s*/i, // TST-… (Toast)
  /^bck\s*\*\s*/i, // BCK*… (Booking/checkout)
  /^ccv\s*\*\s*/i, // CCV*…
  /^paypal\s*\*\s*/i, // PAYPAL *…
  /^iz\s*\*\s*/i, // IZ *… (iZettle legacy)
  /^google\s*\*\s*/i, // GOOGLE *Google One
  /^ppd\s+/i, // PPD … (phone-paid descriptor)
];

// Trailing bank markers: contactless ")))", payment-type suffixes, FX blocks.
const TRAILING_NOISE = [
  /\s*\)\)\)\s*$/, // contactless marker
  /\s+(?:vis|visa|dd|so|bp|cr|dr|mbp|bgc|chq|atm)\s*$/i, // payment-type suffix
  /\s+[a-z]{3}\s+[\d.,]+\s*@\s*[\d.]+(?:\s+visa\s+rate)?\s*(?:vis|visa|dd|cr|dr)?\s*$/i, // "EUR 3.55 @ 1.1525 Visa Rate"
];

/**
 * Classify one token. References are dropped, merchant words kept; a merchant
 * word with a glued-on trailing reference ("THEATRE01732304241") keeps only
 * the word.
 */
function cleanToken(token: string): string | null {
  // Pure digits: short numbers are branch/street numbers (BOOTS/0936); long
  // runs are account/phone references.
  if (/^\d+$/.test(token)) {
    return token.length <= 4 ? token : null;
  }

  const digitGroups = token.match(/\d+/g);
  if (!digitGroups) return token;

  // Interleaved letters/digits (NQ70H8U14, NL19K3JLONDON, GPC02H3PCH) are
  // order references, not names.
  if (digitGroups.length >= 2) return null;

  // Single trailing digit run glued to a word: keep the word
  // (THEATRE01732304241 → theatre, DISNEYPLUS35314369001 → disneyplus).
  const glued = token.match(/^([a-z&]{3,}?)(\d{4,})$/i);
  if (glued) return glued[1];

  // Short embedded digits are part of the name (h3g, 4ocean).
  return token;
}

/**
 * Clean a raw bank descriptor: strip processor prefixes, references and
 * trailing bank noise. Lowercase output with single spaces.
 */
export function normaliseDescription(raw: string): string {
  let s = raw.trim();

  // Peel trailing noise first (FX blocks can hide a processor prefix strip).
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of TRAILING_NOISE) {
      const next = s.replace(re, '');
      if (next !== s) {
        s = next;
        changed = true;
      }
    }
  }

  // Peel processor prefixes (can stack, e.g. INT'L … ZETTLE_*…).
  changed = true;
  while (changed) {
    changed = false;
    for (const re of PROCESSOR_PREFIXES) {
      const next = s.replace(re, '');
      if (next !== s && next.length >= 3) {
        s = next;
        changed = true;
      }
    }
  }

  // Amazon order refs: "AMAZON* NQ70H8U14 - Markers" → "amazon markers";
  // "AMAZON UK* NL19K3JLONDON" → "amazon uk".
  s = s.replace(/^(amazon(?:\s+uk)?(?:\s+prime)?)\s*\*\s*/i, '$1 ');

  // Lowercase; keep letters, digits, & and spaces.
  s = s
    .toLowerCase()
    .replace(/[^a-z0-9&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Drop reference-like tokens (order ids, card fragments, long numbers).
  const tokens = s
    .split(' ')
    .map(cleanToken)
    .filter((t): t is string => t !== null && t.length > 0);

  // Trailing pure-digit tokens are phone numbers / references, not names
  // ("SAINSBURYS.CO.UK 0800 328 1700").
  while (tokens.length > 0 && /^\d+$/.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(' ');
}

/**
 * Canonical merchant key: the first few meaningful tokens of the normalised
 * description. Good enough to group "SAINSBURYS S/MKTS TONBRIDGE" imports
 * together without trying to solve entity resolution.
 */
export function merchantKey(raw: string, maxTokens = 3): string {
  const norm = normaliseDescription(raw);
  if (!norm) return '';
  return norm.split(' ').slice(0, maxTokens).join(' ');
}

/**
 * Is this merchant key specific enough to become a 'contains' rule?
 * Guards against patterns so short they'd match unrelated merchants.
 */
export function isMineablePattern(key: string): boolean {
  return key.length >= 4 && !/^\d+$/.test(key);
}
