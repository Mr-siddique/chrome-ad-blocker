import { parsePattern, validatePattern } from './patterns.js';

export const HEALTH_KEY = 'health';
export const SETTINGS_KEY = 'settings';
export const STATS_KEY = 'statsDaily';
export const SESSION_DISABLED_KEY = 'sessionDisabled';

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  categories: Object.freeze({ images: true, scripts: true, iframes: true }),
});

// Chrome limits sync items to 8192 bytes including key; stay well under it.
const CHUNK_LIMIT = 6000;
const MAX_STATS_DAYS = 90;
const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const QUOTA_ERROR = /quota/i;

const fail = (error) => ({ ok: false, error });
const succeed = (value) => ({ ok: true, value });

async function safeGet(area, keys, fallback) {
  try {
    const result = await chrome.storage[area].get(keys);
    return result || fallback;
  } catch (error) {
    console.error(`storage.${area}.get failed:`, error);
    return fallback;
  }
}

async function writeItems(area, items) {
  try {
    await chrome.storage[area].set(items);
    return succeed(true);
  } catch (error) {
    if (QUOTA_ERROR.test(String(error && error.message))) return fail('quota');
    return fail(String((error && error.message) || error));
  }
}

export function normalizeDomain(input) {
  if (typeof input !== 'string') return null;
  const host = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^\*\./, '')
    .split(/[/?#:]/)[0];
  return DOMAIN_PATTERN.test(host) ? host : null;
}

function splitIntoChunks(list) {
  const chunks = [];
  let current = [];
  let size = 2;
  for (const item of list) {
    const cost = JSON.stringify(item).length + 1;
    if (size + cost > CHUNK_LIMIT && current.length) {
      chunks.push(current);
      current = [];
      size = 2;
    }
    current.push(item);
    size += cost;
  }
  chunks.push(current);
  return chunks;
}

async function readList(name) {
  const meta = await safeGet('sync', `${name}.n`, {});
  const count = Number(meta[`${name}.n`]) || 0;
  if (!count) return [];
  const keys = Array.from({ length: count }, (_, i) => `${name}.${i}`);
  const data = await safeGet('sync', keys, {});
  const list = keys.flatMap((key) => (Array.isArray(data[key]) ? data[key] : []));
  return list.filter((entry) => typeof entry === 'string');
}

async function writeList(name, list) {
  const previous = Number((await safeGet('sync', `${name}.n`, {}))[`${name}.n`]) || 0;
  const chunks = splitIntoChunks(list);
  const items = { [`${name}.n`]: chunks.length };
  chunks.forEach((chunk, i) => { items[`${name}.${i}`] = chunk; });
  const result = await writeItems('sync', items);
  if (!result.ok) return result;
  const stale = [];
  for (let i = chunks.length; i < previous; i += 1) stale.push(`${name}.${i}`);
  if (stale.length) await chrome.storage.sync.remove(stale).catch(() => {});
  return succeed(list);
}

const SYNC_FULL = 'Sync storage is full. Remove some entries and try again.';

async function updateList(name, change) {
  const list = await readList(name);
  const next = change(list);
  if (next === list) return succeed(list);
  const result = await writeList(name, next);
  if (!result.ok && result.error === 'quota') {
    await evictOldestStats();
    const retry = await writeList(name, next);
    return retry.ok ? retry : fail(SYNC_FULL);
  }
  return result;
}

function listApi(name, normalize) {
  const withEntry = (input, run) => {
    const entry = normalize(input);
    return entry.value ? run(entry.value) : Promise.resolve(fail(entry.error));
  };
  return {
    get: () => readList(name),
    set: (values) => updateList(name, () => values),
    add: (input) => withEntry(input, (value) =>
      updateList(name, (list) => (list.includes(value) ? list : [...list, value]))),
    remove: (input) => withEntry(input, (value) =>
      updateList(name, (list) => (list.includes(value) ? list.filter((d) => d !== value) : list))),
    has: async (hostname) => {
      const host = normalizeDomain(hostname);
      const list = await readList(name);
      return Boolean(host) && list.some((entry) => host === entry || host.endsWith(`.${entry}`));
    },
  };
}

const domainEntry = (input) => {
  const value = normalizeDomain(input);
  return value ? { value } : { error: 'Invalid domain' };
};

export function normalizePattern(input) {
  const check = validatePattern(input);
  if (!check.valid) return { error: check.error };
  const { host, path } = parsePattern(input);
  return { value: `${host}${path}` };
}

const whitelist = listApi('whitelist', domainEntry);
const blacklist = listApi('blacklist', domainEntry);
const patterns = listApi('customPatterns', normalizePattern);

async function moveBetween(domainInput, adder, remover) {
  const added = await adder(domainInput);
  if (added.ok) await remover(domainInput);
  return added;
}

export const getWhitelist = whitelist.get;
export const removeFromWhitelist = whitelist.remove;
export const isWhitelisted = whitelist.has;
export const getCustomPatterns = patterns.get;
export const addCustomPattern = patterns.add;
export const removeCustomPattern = patterns.remove;
export const setCustomPatterns = patterns.set;
export const getBlacklist = blacklist.get;
export const removeFromBlacklist = blacklist.remove;
export const isBlacklisted = blacklist.has;
export const addToWhitelist = (domain) => moveBetween(domain, whitelist.add, blacklist.remove);
export const addToBlacklist = (domain) => moveBetween(domain, blacklist.add, whitelist.remove);

function mergeSettings(stored) {
  const value = stored && typeof stored === 'object' ? stored : {};
  const categories = { ...DEFAULT_SETTINGS.categories, ...(value.categories || {}) };
  return { ...DEFAULT_SETTINGS, ...value, categories };
}

export async function getSettings() {
  const data = await safeGet('sync', SETTINGS_KEY, {});
  return mergeSettings(data[SETTINGS_KEY]);
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const categories = { ...current.categories, ...(patch.categories || {}) };
  const next = mergeSettings({ ...current, ...patch, categories });
  const result = await writeItems('sync', { [SETTINGS_KEY]: next });
  return result.ok ? succeed(next) : fail(result.error === 'quota' ? SYNC_FULL : result.error);
}

export async function resetSettings() {
  return saveSettings({ ...DEFAULT_SETTINGS, categories: { ...DEFAULT_SETTINGS.categories } });
}

export async function setSessionDisabled(disabled) {
  return writeItems('local', { [SESSION_DISABLED_KEY]: Boolean(disabled) });
}

export async function isSessionDisabled() {
  const data = await safeGet('local', SESSION_DISABLED_KEY, {});
  return data[SESSION_DISABLED_KEY] === true;
}

// Blacklist forces blocking; otherwise whitelist and global/session switches turn it off.
export async function isBlockingEnabledFor(hostname) {
  if (await isBlacklisted(hostname)) return true;
  if (await isWhitelisted(hostname)) return false;
  const settings = await getSettings();
  return settings.enabled && !(await isSessionDisabled());
}

export async function getHealth() {
  const data = await safeGet('local', HEALTH_KEY, {});
  return data[HEALTH_KEY] || { ok: true, error: null };
}

export async function setHealth(health) {
  return writeItems('local', { [HEALTH_KEY]: health });
}

export async function getBlockedStats() {
  const data = await safeGet('local', STATS_KEY, {});
  const days = data[STATS_KEY] && typeof data[STATS_KEY] === 'object' ? data[STATS_KEY] : {};
  const total = Object.values(days).reduce((sum, day) => sum + (day.total || 0), 0);
  return { total, days };
}

function addToDay(days, dayKey, platform, count, domain) {
  const day = days[dayKey] || { total: 0, byPlatform: {}, domains: {} };
  day.total += count;
  day.byPlatform[platform] = (day.byPlatform[platform] || 0) + count;
  if (domain) day.domains[domain] = (day.domains[domain] || 0) + count;
  return { ...days, [dayKey]: day };
}

export async function evictOldestStats(keepRatio = 0.5) {
  const { days } = await getBlockedStats();
  const keys = Object.keys(days).sort();
  const keep = Math.floor(keys.length * keepRatio);
  const kept = Object.fromEntries(keys.slice(keys.length - keep).map((key) => [key, days[key]]));
  await writeItems('local', { [STATS_KEY]: kept });
  return keys.length - keep;
}

export async function recordBlocked({ platform, count = 1, domain = null, now = Date.now() }) {
  const { days } = await getBlockedStats();
  const dayKey = new Date(now).toISOString().slice(0, 10);
  const updated = addToDay(days, dayKey, platform || 'general', count, domain);
  const keys = Object.keys(updated).sort().slice(-MAX_STATS_DAYS);
  const trimmed = Object.fromEntries(keys.map((key) => [key, updated[key]]));
  const result = await writeItems('local', { [STATS_KEY]: trimmed });
  if (result.ok || result.error !== 'quota') return result;
  await evictOldestStats();
  const remaining = (await getBlockedStats()).days;
  return writeItems('local', { [STATS_KEY]: { ...remaining, [dayKey]: trimmed[dayKey] } });
}

export async function getRuleSet() {
  const [customPatterns, whitelistEntries, blacklistEntries, settings] = await Promise.all([
    patterns.get(), whitelist.get(), blacklist.get(), getSettings(),
  ]);
  return {
    customPatterns,
    whitelist: whitelistEntries,
    blacklist: blacklistEntries,
    categories: { ...settings.categories },
  };
}

async function writeRuleSet(ruleSet) {
  const steps = [
    () => patterns.set(ruleSet.customPatterns),
    () => whitelist.set(ruleSet.whitelist),
    () => blacklist.set(ruleSet.blacklist),
    () => saveSettings({ categories: ruleSet.categories }),
  ];
  for (const step of steps) {
    const result = await step();
    if (!result.ok) return result;
  }
  return succeed(ruleSet);
}

// Replaces all user rules; if any write fails the previous rules are restored.
export async function applyRuleSet(ruleSet) {
  const previous = await getRuleSet();
  const result = await writeRuleSet(ruleSet);
  if (result.ok) return result;
  await writeRuleSet(previous);
  return result;
}

export async function resetToDefaults() {
  const defaults = {
    customPatterns: [],
    whitelist: [],
    blacklist: [],
    categories: { ...DEFAULT_SETTINGS.categories },
  };
  const result = await writeRuleSet(defaults);
  if (!result.ok) return result;
  return saveSettings({ enabled: DEFAULT_SETTINGS.enabled });
}
