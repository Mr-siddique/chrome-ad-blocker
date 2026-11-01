import { ruleToUrlFilters } from './dnr-rules.js';
import * as tabStats from './tab-stats.js';

// Dynamic rule id ranges that block (see dynamic-rules.js): blacklist 1000-1999, custom 2000-3999.
const DYNAMIC_BLOCK_RANGE = [1000, 3999];
const HEURISTIC_PRIORITY = 1;
const HEURISTIC_DOMAIN = 'VAST/VPAID request';
const BUDGET = { windowMs: 10 * 60 * 1000, maxCalls: 18 };

let callTimes = [];

export function hostOf(urlFilter) {
  const match = /^\|\|([^/^|]+)/.exec(urlFilter);
  return match ? match[1] : null;
}

function platformByFilter(filters) {
  const map = new Map();
  for (const filter of filters) {
    for (const rule of filter.rules) {
      for (const urlFilter of ruleToUrlFilters(rule)) map.set(urlFilter, filter.platform);
    }
  }
  return map;
}

// Only block rules are indexed: getMatchedRules also reports allow rules, which must not count.
export function buildRuleIndex(rulesets, filters) {
  const platforms = platformByFilter(filters);
  const index = new Map();
  for (const [rulesetId, rules] of Object.entries(rulesets)) {
    for (const rule of rules.filter((r) => r.action.type === 'block')) {
      const { urlFilter } = rule.condition;
      const heuristic = rule.priority === HEURISTIC_PRIORITY;
      index.set(`${rulesetId}:${rule.id}`, {
        platform: platforms.get(urlFilter) || 'general',
        domain: heuristic ? HEURISTIC_DOMAIN : hostOf(urlFilter) || urlFilter,
      });
    }
  }
  return index;
}

export function classifyMatch(rule, index) {
  const known = index.get(`${rule.rulesetId}:${rule.ruleId}`);
  if (known) return known;
  const [low, high] = DYNAMIC_BLOCK_RANGE;
  const dynamic = rule.rulesetId === '_dynamic' && rule.ruleId >= low && rule.ruleId <= high;
  return dynamic ? { platform: 'general', domain: 'your block list' } : null;
}

// getMatchedRules is quota-limited in some Chrome versions; background polls stay under it.
export function withinBudget(now = Date.now()) {
  callTimes = callTimes.filter((time) => now - time < BUDGET.windowMs);
  if (callTimes.length >= BUDGET.maxCalls) return false;
  callTimes.push(now);
  return true;
}

export function resetBudget() {
  callTimes = [];
}

function groupByPlatform(matches, since, index) {
  const byPlatform = {};
  let latest = since;
  for (const { rule, timeStamp } of matches) {
    if (timeStamp <= since) continue;
    latest = Math.max(latest, timeStamp);
    const info = classifyMatch(rule, index);
    if (info) (byPlatform[info.platform] = byPlatform[info.platform] || []).push({ domain: info.domain });
  }
  return { byPlatform, latest };
}

// Returns true when new network blocks were recorded for the tab.
export async function refreshNetworkStats(tabId, index, { force = false } = {}) {
  if (!force && !withinBudget()) return false;
  const since = tabStats.getNetSince(tabId);
  try {
    const { rulesMatchedInfo } = await chrome.declarativeNetRequest.getMatchedRules({ tabId, minTimeStamp: since });
    const { byPlatform, latest } = groupByPlatform(rulesMatchedInfo || [], since, index);
    tabStats.setNetSince(tabId, latest);
    for (const [platform, items] of Object.entries(byPlatform)) tabStats.recordRemoved(tabId, platform, items);
    return Object.keys(byPlatform).length > 0;
  } catch (error) {
    // Tab closed, quota hit, or permission missing: counts then reflect DOM removals only.
    return false;
  }
}
