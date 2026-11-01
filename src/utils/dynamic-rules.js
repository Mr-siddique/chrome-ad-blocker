import { BLOCKED_RESOURCE_TYPES, ruleToUrlFilters } from './dnr-rules.js';
import { parsePattern } from './patterns.js';
import { getBlacklist, getCustomPatterns, getSettings, getWhitelist } from './storage.js';

// Dynamic rule id ranges (Chrome allows 5000 dynamic rules).
export const ID_RANGES = { whitelist: 1, blacklist: 1000, custom: 2000, category: 4000 };
const RANGE_SIZE = 900;

// Custom patterns share the host priority (3) so category allows (4) can exempt them.
const PRIORITY = { custom: 3, categoryAllow: 4, blacklist: 5, whitelist: 10 };
const CATEGORY_TYPES = { images: 'image', scripts: 'script', iframes: 'sub_frame' };
const CUSTOM_LIMIT = 1900;
const FRAME_TYPES = ['main_frame', 'sub_frame'];

function listRules(domains, base, priority, action, resourceTypes) {
  return domains.slice(0, RANGE_SIZE).map((domain, i) => ({
    id: base + i,
    priority,
    action,
    condition: { urlFilter: `||${domain}^`, resourceTypes },
  }));
}

function customRules(patterns) {
  const filters = patterns.flatMap((pattern) => ruleToUrlFilters(parsePattern(pattern)));
  return filters.slice(0, CUSTOM_LIMIT).map((urlFilter, i) => ({
    id: ID_RANGES.custom + i,
    priority: PRIORITY.custom,
    action: { type: 'block' },
    condition: { urlFilter, resourceTypes: BLOCKED_RESOURCE_TYPES },
  }));
}

// A disabled category exempts that resource type from every block rule below priority 4.
function categoryRules(categories) {
  return Object.entries(CATEGORY_TYPES)
    .filter(([key]) => categories[key] === false)
    .map(([, type], i) => ({
      id: ID_RANGES.category + i,
      priority: PRIORITY.categoryAllow,
      action: { type: 'allow' },
      condition: { resourceTypes: [type] },
    }));
}

export function buildDynamicRules({ whitelist = [], blacklist = [], customPatterns = [], categories = {} }) {
  return [
    ...listRules(whitelist, ID_RANGES.whitelist, PRIORITY.whitelist, { type: 'allowAllRequests' }, FRAME_TYPES),
    ...listRules(blacklist, ID_RANGES.blacklist, PRIORITY.blacklist, { type: 'block' }, BLOCKED_RESOURCE_TYPES),
    ...customRules(customPatterns),
    ...categoryRules(categories),
  ];
}

let queue = Promise.resolve();

async function applyDynamicRules(extraRules) {
  const [whitelist, blacklist, customPatterns, settings] = await Promise.all([
    getWhitelist(), getBlacklist(), getCustomPatterns(), getSettings(),
  ]);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: [
      ...buildDynamicRules({ whitelist, blacklist, customPatterns, categories: settings.categories }),
      ...extraRules,
    ],
  });
}

// Serialized: concurrent syncs would race on rule ids.
export function syncDynamicRules(extraRules = []) {
  const run = queue.then(() => applyDynamicRules(extraRules));
  queue = run.catch(() => {});
  return run;
}
