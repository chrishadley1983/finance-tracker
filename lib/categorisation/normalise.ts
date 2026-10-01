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
 *
 * Any other token containing a digit is dropped: branch numbers, order ids and
 * card fragments vary per transaction, so keeping them splits one merchant into
 * many keys and lets mining learn junk rules from order numbers
 * ("eBay O*23-…" once mined as `ebay o 23` → Lego Out).
 */
function cleanToken(token: string): string | null {
  if (!/\d/.test(token)) return token;

  // Single trailing digit run glued to a word: keep the word
  // (THEATRE01732304241 → theatre, DISNEYPLUS35314369001 → disneyplus).
  const glued = token.match(/^([a-z&]{3,}?)(\d{4,})$/i);
  if (glued) return glued[1];

  return null;
}

// Two-letter tokens that are real words in descriptors, not reference
// prefixes ("SAINSBURYS.CO.UK 0800…", "AMAZON UK* NL19…").
const SHORT_WORDS = new Set(['uk', 'co', 'st', 'sf', 'of', 'my', 'at', 'by', 'on', 'in', 'to', 'gb', 'us', 'eu']);

/**
 * Drop reference tokens, plus the 1–2 letter token immediately before a
 * dropped one — it is the reference's prefix ("o" in "ebay o 23 15143").
 */
function dropReferences(tokens: string[]): string[] {
  const cleaned = tokens.map(cleanToken);
  const kept: string[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const t = cleaned[i];
    if (t === null || t.length === 0) continue;
    const nextDropped = i + 1 < cleaned.length && cleaned[i + 1] === null;
    if (nextDropped && t.length <= 2 && !SHORT_WORDS.has(t)) continue;
    kept.push(t);
  }
  return kept;
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

  // Drop reference-like tokens (order ids, card fragments, branch numbers).
  return dropReferences(s.split(' ')).join(' ');
}

/**
 * Normalise a rule pattern for token-bounded comparison against
 * normaliseDescription() output: lowercase, punctuation → spaces. Unlike
 * normaliseDescription it does NOT strip processor prefixes — a pattern is
 * already the merchant text Chris (or mining) chose.
 */
export function normalisePattern(pattern: string): string {
  return pattern
    .toLowerCase()
    .replace(/[^a-z0-9&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  return key.length >= 4 && !/\d/.test(key);
}
