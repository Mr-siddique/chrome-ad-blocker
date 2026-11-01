import { normalizePattern, normalizeDomain } from './storage.js';

export const EXPORT_FORMAT = 'streaming-ad-blocker-rules';
export const EXPORT_VERSION = 1;
export const MAX_IMPORT_BYTES = 256 * 1024;
const MAX_ENTRIES = 2000;
const CATEGORY_KEYS = ['images', 'scripts', 'iframes'];

export function serializeExport(ruleSet) {
  return JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, ...ruleSet }, null, 2);
}

function cleanList(values, normalize, skipped) {
  if (!Array.isArray(values)) return null;
  const seen = new Set();
  for (const value of values) {
    const normalized = typeof value === 'string' ? normalize(value) : null;
    if (normalized && !seen.has(normalized)) seen.add(normalized);
    else if (!normalized) skipped.count += 1;
  }
  return [...seen];
}

function cleanCategories(value, skipped) {
  const categories = {};
  if (!value || typeof value !== 'object') return null;
  for (const key of CATEGORY_KEYS) {
    if (typeof value[key] === 'boolean') categories[key] = value[key];
    else skipped.count += 1;
  }
  return CATEGORY_KEYS.every((key) => key in categories) ? categories : { images: true, scripts: true, iframes: true, ...categories };
}

function parseJson(text) {
  if (typeof text !== 'string' || !text.trim()) return { error: 'Nothing to import' };
  if (text.length > MAX_IMPORT_BYTES) return { error: 'Import file is too large' };
  try {
    return { data: JSON.parse(text) };
  } catch (error) {
    return { error: 'Import file is not valid JSON' };
  }
}

function checkHeader(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Import file has the wrong structure';
  if (data.format !== EXPORT_FORMAT) return 'Import file is not a Streaming Ad Blocker export';
  if (data.version !== EXPORT_VERSION) return `Unsupported export version: ${data.version}`;
  return null;
}

// Rejects malformed files outright; skips individual bad entries and reports how many.
export function parseImport(text) {
  const parsed = parseJson(text);
  if (parsed.error) return { ok: false, error: parsed.error };
  const headerError = checkHeader(parsed.data);
  if (headerError) return { ok: false, error: headerError };
  const skipped = { count: 0 };
  const data = parsed.data;
  const ruleSet = {
    customPatterns: cleanList(data.customPatterns, (v) => normalizePattern(v).value || null, skipped),
    whitelist: cleanList(data.whitelist, normalizeDomain, skipped),
    blacklist: cleanList(data.blacklist, normalizeDomain, skipped),
    categories: cleanCategories(data.categories, skipped),
  };
  if (Object.values(ruleSet).some((value) => value === null)) {
    return { ok: false, error: 'Import file is missing required lists' };
  }
  if ([ruleSet.customPatterns, ruleSet.whitelist, ruleSet.blacklist].some((l) => l.length > MAX_ENTRIES)) {
    return { ok: false, error: 'Import file has too many entries' };
  }
  return { ok: true, ruleSet, skipped: skipped.count };
}

export function ruleSetsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
