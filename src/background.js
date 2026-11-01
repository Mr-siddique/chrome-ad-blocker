import { HEALTH_KEY, loadBundledFilters } from './utils/rules-loader.js';

const STREAMING_RULESET = 'streaming';
const WARNING_BADGE = { text: '!', color: '#c62828' };

async function disableBlocking(error) {
  console.error('Ad blocker disabled: bundled filter list invalid:', error);
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: [STREAMING_RULESET] });
  } catch (rulesetError) {
    console.error('Could not disable ruleset:', rulesetError);
  }
  await chrome.action.setBadgeBackgroundColor({ color: WARNING_BADGE.color });
  await chrome.action.setBadgeText({ text: WARNING_BADGE.text });
}

async function recordHealth(bundle) {
  const health = { ok: bundle.ok, error: bundle.error, checkedAt: Date.now() };
  try {
    await chrome.storage.local.set({ [HEALTH_KEY]: health });
  } catch (error) {
    console.error('Could not persist health state:', error);
  }
  return health;
}

export async function initialize(loader = loadBundledFilters) {
  const bundle = loader();
  const health = await recordHealth(bundle);
  if (!bundle.ok) await disableBlocking(bundle.error);
  return health;
}

export function registerListeners() {
  chrome.runtime.onInstalled.addListener(() => initialize());
  chrome.runtime.onStartup.addListener(() => initialize());
}

registerListeners();
// A terminated service worker restarts without firing onStartup, so re-check on every wake.
initialize();
