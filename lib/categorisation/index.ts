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
  toDbCategorisationSource,
  toTransactionCategoryFields,
  type ParsedTransaction,
  type CategorisationResult,
  type CategorisationStats,
  type EngineSource,
} from './engine';

export { normaliseDescription, normalisePattern, merchantKey, isMineablePattern } from './normalise';

export {
  matchRule,
  matchExactRule,
  matchPatternRule,
  matchRulesBatch,
  selectRule,
  ruleApplies,
  isPolicyRule,
  type RuleMatch,
  type RuleRecord,
  type RuleContext,
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
