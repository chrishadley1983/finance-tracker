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
  type ParsedTransaction,
  type CategorisationResult,
  type CategorisationStats,
} from './engine';

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
