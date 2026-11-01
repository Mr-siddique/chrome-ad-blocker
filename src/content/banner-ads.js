import { GENERAL_FILTER, GENERAL_RULE_SET } from '../filters/general-ads.js';

export const BANNER_PLATFORM = 'general';

export function getBannerContext() {
  return { filter: GENERAL_FILTER, ruleSet: GENERAL_RULE_SET };
}
