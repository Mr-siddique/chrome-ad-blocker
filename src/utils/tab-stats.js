export const TAB_STATS_KEY = 'tabStats';
export const PLATFORM_LABELS = {
  'prime-video': 'Prime Video',
  'jio-hotstar': 'Jio Hotstar',
  youtube: 'YouTube',
  general: 'web',
};

const tabs = new Map();

// netSince is the timestamp of the newest network-level block already counted for the tab.
const emptyStats = () => ({ count: 0, byPlatform: {}, domains: {}, netSince: Date.now() });

export function resetTab(tabId) {
  tabs.set(tabId, emptyStats());
}

export function ensureTab(tabId) {
  if (!tabs.has(tabId)) tabs.set(tabId, emptyStats());
}

export function getNetSince(tabId) {
  const stats = tabs.get(tabId);
  return stats && Number.isFinite(stats.netSince) ? stats.netSince : 0;
}

export function setNetSince(tabId, timestamp) {
  ensureTab(tabId);
  tabs.get(tabId).netSince = timestamp;
}

export function removeTab(tabId) {
  tabs.delete(tabId);
}

export function clearAllTabs() {
  tabs.clear();
}

export function recordRemoved(tabId, platform, items) {
  const stats = tabs.get(tabId) || emptyStats();
  for (const item of items) {
    stats.count += 1;
    stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
    if (item.domain) stats.domains[item.domain] = (stats.domains[item.domain] || 0) + 1;
  }
  tabs.set(tabId, stats);
  return getTabStats(tabId);
}

export function getTabStats(tabId) {
  const stats = tabs.get(tabId) || emptyStats();
  const domains = Object.entries(stats.domains)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
  return { count: stats.count, byPlatform: { ...stats.byPlatform }, domains };
}

export function platformLabel(platform, count) {
  const name = PLATFORM_LABELS[platform] || platform;
  return `Blocked ${count} ${name} ad${count === 1 ? '' : 's'}`;
}

export function badgeText(count) {
  if (!count) return '';
  return count > 999 ? '999+' : String(count);
}

export async function persistTabStats() {
  try {
    await chrome.storage.local.set({ [TAB_STATS_KEY]: Object.fromEntries(tabs) });
  } catch (error) {
    console.error('Could not persist tab stats:', error);
  }
}

export async function restoreTabStats() {
  if (tabs.size) return;
  try {
    const data = await chrome.storage.local.get(TAB_STATS_KEY);
    const saved = data[TAB_STATS_KEY] || {};
    for (const [tabId, stats] of Object.entries(saved)) tabs.set(Number(tabId), stats);
  } catch (error) {
    console.error('Could not restore tab stats:', error);
  }
}
