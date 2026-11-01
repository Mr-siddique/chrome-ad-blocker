import { GENERAL_FILTER } from '../filters/general-ads.js';
import { JIO_HOTSTAR_FILTER } from '../filters/jio-hotstar.js';
import { PRIME_VIDEO_FILTER } from '../filters/prime-video.js';
import { isVastVpaidRequest } from '../filters/vast-vpaid.js';
import { buildRuleSet, shouldBlockUrl } from './filters.js';
import { validatePattern } from './patterns.js';

export { HEALTH_KEY } from './storage.js';
const DEFAULT_FILTERS = [PRIME_VIDEO_FILTER, JIO_HOTSTAR_FILTER, GENERAL_FILTER];

export function validateFilterList(filter) {
  if (!filter || typeof filter !== 'object') return 'filter list is not an object';
  if (!filter.id || !filter.version) return 'filter list is missing id or version';
  if (!Array.isArray(filter.rules) || filter.rules.length === 0) return `${filter.id}: no rules`;
  const badIndex = filter.rules.findIndex(
    (rule) => !rule || !validatePattern(`${rule.host}${rule.path || ''}`).valid
  );
  return badIndex >= 0 ? `${filter.id}: invalid rule at index ${badIndex}` : null;
}

// Fails safe: any corruption yields ok:false and no rule set, never a partial list.
export function loadBundledFilters(filters = DEFAULT_FILTERS) {
  try {
    for (const filter of filters) {
      const error = validateFilterList(filter);
      if (error) return { ok: false, error, ruleSet: null };
    }
    const ruleSet = buildRuleSet(filters.flatMap((filter) => filter.rules));
    return { ok: true, error: null, ruleSet, filters };
  } catch (error) {
    return { ok: false, error: String(error && error.message), ruleSet: null };
  }
}

export function shouldBlockRequest(url, bundle) {
  if (!bundle || !bundle.ok) return false;
  return isVastVpaidRequest(url) || shouldBlockUrl(url, bundle.ruleSet);
}
