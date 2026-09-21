/**
 * Parser for dividenddata.co.uk's index-linked gilt table. The implementation
 * lives in plan/engine/ladder.mjs (pure string → rows); re-exported here for
 * the API route and tests.
 */
import type { GiltPrice } from './assumptions';
import { parseGiltTable as engineParse } from '../../plan/engine/ladder.mjs';

export const parseGiltTable = (html: string): GiltPrice[] => engineParse(html);
