/**
 * Categorisation Engine
 *
 * Multi-strategy transaction categorisation using rules, similarity, and AI.
 */

export {
  categoriseTransaction,
  categoriseMultiple,
  calculateStats,
  clearRulesCache,
  clearCategoriesCache,
  checkAIAvailability,
  CONFIDENCE_REVIEW_THRESHOLD,
  type ParsedTransaction,
  type CategorisationResult,
  type CategorisationStats,
} from './engine';

export { normaliseDescription, merchantKey, isMineablePattern } from './normalise';

export {
  matchRule,
  matchExactRule,
  matchPatternRule,
  matchRulesBatch,
  type RuleMatch,
} from './rule-matcher';

export {
  findSimilarTransactions,
  findSimilarBatch,
  getMostCommonCategory,
  type SimilarMatch,
} from './similar-lookup';

export {
  categoriseWithAI,
  categoriseBatchWithAI,
  trackAIUsage,
  AICategorisationError,
} from './ai-categoriser';
