import { BLOCKED_RESOURCE_TYPES } from './dnr-rules.js';
import { getBlacklist, getWhitelist } from './storage.js';

// Dynamic rule id ranges (Chrome allows 5000 dynamic rules).
export const ID_RANGES = { whitelist: 1, blacklist: 1000, custom: 2000, category: 4000 };
const RANGE_SIZE = 900;

const PRIORITY = { blacklist: 5, whitelist: 10 };
const FRAME_TYPES = ['main_frame', 'sub_frame'];

export function buildDynamicRules({ whitelist = [], blacklist = [] }) {
  const allow = whitelist.slice(0, RANGE_SIZE).map((domain, i) => ({
    id: ID_RANGES.whitelist + i,
    priority: PRIORITY.whitelist,
    action: { type: 'allowAllRequests' },
    condition: { urlFilter: `||${domain}^`, resourceTypes: FRAME_TYPES },
  }));
  const block = blacklist.slice(0, RANGE_SIZE).map((domain, i) => ({
    id: ID_RANGES.blacklist + i,
    priority: PRIORITY.blacklist,
    action: { type: 'block' },
    condition: { urlFilter: `||${domain}^`, resourceTypes: BLOCKED_RESOURCE_TYPES },
  }));
  return [...allow, ...block];
}

export async function syncDynamicRules(extraRules = []) {
  const [whitelist, blacklist] = await Promise.all([getWhitelist(), getBlacklist()]);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: [...buildDynamicRules({ whitelist, blacklist }), ...extraRules],
  });
}
