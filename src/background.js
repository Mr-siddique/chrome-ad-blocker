import { MSG, validateMessage } from './utils/messaging.js';
import { syncDynamicRules } from './utils/dynamic-rules.js';
import { loadBundledFilters } from './utils/rules-loader.js';
import * as storage from './utils/storage.js';
import * as tabStats from './utils/tab-stats.js';

const RULESETS = ['streaming', 'general'];
const BADGE_COLOR = '#1a73e8';
const WARNING_BADGE = { text: '!', color: '#c62828' };

async function disableBlocking(error) {
  console.error('Ad blocker disabled: bundled filter list invalid:', error);
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: RULESETS });
  } catch (rulesetError) {
    console.error('Could not disable ruleset:', rulesetError);
  }
  try {
    await chrome.action.setBadgeBackgroundColor({ color: WARNING_BADGE.color });
    await chrome.action.setBadgeText({ text: WARNING_BADGE.text });
  } catch (badgeError) {
    console.error('Could not show warning badge:', badgeError);
  }
}

export async function initialize(loader = loadBundledFilters) {
  const bundle = loader();
  const health = { ok: bundle.ok, error: bundle.error, checkedAt: Date.now() };
  await storage.setHealth(health);
  if (!bundle.ok) await disableBlocking(bundle.error);
  return health;
}

export async function applyBlockingState() {
  const health = await storage.getHealth();
  const settings = await storage.getSettings();
  const enabled = health.ok && settings.enabled && !(await storage.isSessionDisabled());
  const key = enabled ? 'enableRulesetIds' : 'disableRulesetIds';
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ [key]: RULESETS });
  } catch (error) {
    console.error('Could not update rulesets:', error);
  }
  return enabled;
}

async function updateBadge(tabId, count) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    await chrome.action.setBadgeText({ tabId, text: tabStats.badgeText(count) });
  } catch (error) {
    // The tab may already be closed; the badge is cosmetic.
  }
}

async function onAdBlocked(message, sender) {
  const tabId = sender.tab && sender.tab.id;
  if (typeof tabId !== 'number') return { ok: false, error: 'No tab' };
  const stats = tabStats.recordRemoved(tabId, message.platform, message.items);
  await updateBadge(tabId, stats.count);
  await tabStats.persistTabStats();
  await storage.recordBlocked({ platform: message.platform, count: message.items.length });
  return { ok: true, count: stats.count };
}

async function onPageStart(message, sender) {
  const tabId = sender.tab && sender.tab.id;
  if (message.topFrame && typeof tabId === 'number') {
    tabStats.resetTab(tabId);
    await updateBadge(tabId, 0);
  }
  return { ok: true };
}

async function onBlockingState(message) {
  const [allowed, settings, health] = await Promise.all([
    storage.isBlockingEnabledFor(message.hostname), storage.getSettings(), storage.getHealth(),
  ]);
  // A corrupted bundled list disables blocking everywhere, including DOM removal.
  return { ok: true, enabled: allowed && health.ok !== false, categories: settings.categories };
}

async function onPopupState(message) {
  const [settings, health, sessionDisabled, whitelisted, blacklisted] = await Promise.all([
    storage.getSettings(), storage.getHealth(), storage.isSessionDisabled(),
    storage.isWhitelisted(message.hostname), storage.isBlacklisted(message.hostname),
  ]);
  const stats = tabStats.getTabStats(message.tabId);
  const labels = Object.entries(stats.byPlatform).map(([platform, count]) => ({
    platform, count, text: tabStats.platformLabel(platform, count),
  }));
  return { ok: true, settings, health, sessionDisabled, whitelisted, blacklisted, stats, labels };
}

async function updateList(adder, remover, flag, domain) {
  const result = await (flag ? adder(domain) : remover(domain));
  if (result.ok) await syncDynamicRules();
  return result;
}

async function onSetDisabled(message) {
  if (message.scope === 'session') {
    await storage.setSessionDisabled(message.disabled);
  } else {
    await storage.saveSettings({ enabled: !message.disabled });
    if (!message.disabled) await storage.setSessionDisabled(false);
  }
  return { ok: true, enabled: await applyBlockingState() };
}

const HANDLERS = {
  [MSG.PAGE_START]: onPageStart,
  [MSG.AD_BLOCKED]: onAdBlocked,
  [MSG.GET_BLOCKING_STATE]: onBlockingState,
  [MSG.GET_TAB_STATS]: async (m) => ({ ok: true, stats: tabStats.getTabStats(m.tabId) }),
  [MSG.GET_POPUP_STATE]: onPopupState,
  [MSG.SET_WHITELIST]: (m) => updateList(storage.addToWhitelist, storage.removeFromWhitelist, m.whitelisted, m.domain),
  [MSG.SET_BLACKLIST]: (m) => updateList(storage.addToBlacklist, storage.removeFromBlacklist, m.blacklisted, m.domain),
  [MSG.SET_DISABLED]: onSetDisabled,
};

export async function handleMessage(message, sender = {}) {
  const check = validateMessage(message);
  if (!check.ok) return check;
  try {
    return await HANDLERS[message.type](message, sender);
  } catch (error) {
    console.error('Message handler failed:', error);
    return { ok: false, error: String((error && error.message) || error) };
  }
}

const RULE_KEY = /^(whitelist|blacklist|customPatterns)\.|^settings$/;

// The options page edits storage directly; the worker re-derives dynamic rules from it.
export async function onStorageChanged(changes, area) {
  if (area !== 'sync' || !Object.keys(changes).some((key) => RULE_KEY.test(key))) return;
  try {
    await syncDynamicRules();
    await applyBlockingState();
  } catch (error) {
    console.error('Could not apply rule changes:', error);
  }
}

export async function bootstrap({ startup = false } = {}) {
  if (startup) {
    await storage.setSessionDisabled(false);
    tabStats.clearAllTabs();
    await tabStats.persistTabStats();
  }
  await initialize();
  await syncDynamicRules();
  await applyBlockingState();
}

function logFailure(label) {
  return (error) => console.error(`${label} failed:`, error);
}

export function registerListeners() {
  chrome.runtime.onInstalled.addListener(() => bootstrap().catch(logFailure('install')));
  chrome.runtime.onStartup.addListener(() => bootstrap({ startup: true }).catch(logFailure('startup')));
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true;
  });
  chrome.storage.onChanged.addListener(onStorageChanged);
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabStats.removeTab(tabId);
    tabStats.persistTabStats();
  });
}

registerListeners();
// A terminated service worker restarts without firing onStartup, so re-check on every wake.
initialize().catch(logFailure('initialize'));
tabStats.restoreTabStats().catch(logFailure('restore'));
