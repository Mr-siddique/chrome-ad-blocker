import { hostToRegExp } from './patterns.js';

const SUBTITLE_EXTENSIONS = /\.(vtt|srt|ttml|dfxp|ssa|ass|sub)$/i;
const SUBTITLE_PATH = /\/(subtitles?|captions?|timedtext)(\/|$)/i;
const MANIFEST_EXTENSIONS = /\.(mpd|m3u8|ism|ismc)$/i;
const SEGMENT_EXTENSIONS = /\.(m4s|ts|m4a|m4v|cmfv|cmfa)$/i;

export function parseUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  try {
    const parsed = new URL(url);
    if (!/^(https?|wss?):$/.test(parsed.protocol)) return null;
    return { host: parsed.hostname.toLowerCase(), path: parsed.pathname, search: parsed.search };
  } catch (error) {
    return null;
  }
}

function pathMatches(rulePath, path) {
  if (!rulePath) return true;
  const prefix = rulePath.toLowerCase();
  const lower = path.toLowerCase();
  if (!lower.startsWith(prefix)) return false;
  return lower.length === prefix.length || prefix.endsWith('/') || lower[prefix.length] === '/';
}

function ruleMatches(rule, parsed) {
  if (!pathMatches(rule.path, parsed.path)) return false;
  if (!rule.contains) return true;
  const haystack = `${parsed.path}${parsed.search}`.toLowerCase();
  return [].concat(rule.contains).every((part) => haystack.includes(part.toLowerCase()));
}

export function buildRuleSet(rules = [], options = {}) {
  const exact = new Map();
  const wildcards = [];
  for (const rule of rules) {
    const host = rule.host.toLowerCase();
    if (host.includes('*')) {
      wildcards.push({ regex: hostToRegExp(host), rule });
    } else if (exact.has(host)) {
      exact.get(host).push(rule);
    } else {
      exact.set(host, [rule]);
    }
  }
  return {
    exact,
    wildcards,
    size: rules.length,
    classPatterns: options.classPatterns || [],
    sizes: options.sizes || [],
  };
}

function* hostSuffixes(host) {
  const labels = host.split('.');
  for (let i = 0; i < labels.length - 1; i += 1) yield labels.slice(i).join('.');
}

export function matchUrl(url, ruleSet) {
  const parsed = parseUrl(url);
  if (!parsed || !ruleSet) return null;
  for (const suffix of hostSuffixes(parsed.host)) {
    const hit = (ruleSet.exact.get(suffix) || []).find((rule) => ruleMatches(rule, parsed));
    if (hit) return hit;
  }
  const wildcard = ruleSet.wildcards.find(
    (entry) => entry.regex.test(parsed.host) && ruleMatches(entry.rule, parsed)
  );
  return wildcard ? wildcard.rule : null;
}

export function isSubtitleUrl(url) {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  return SUBTITLE_EXTENSIONS.test(parsed.path) || SUBTITLE_PATH.test(parsed.path);
}

export function isAllowlistedPlayerResource(url) {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  if (isSubtitleUrl(url)) return true;
  return MANIFEST_EXTENSIONS.test(parsed.path) || SEGMENT_EXTENSIONS.test(parsed.path);
}

// Subtitles are never blocked. Manifests and content segments are protected from
// heuristic rules only; an explicit ad-host rule may still block an ad manifest.
export function shouldBlockUrl(url, ruleSet) {
  if (isSubtitleUrl(url)) return false;
  const rule = matchUrl(url, ruleSet);
  if (!rule) return false;
  return !(rule.heuristic && isAllowlistedPlayerResource(url));
}

function matchesSize(descriptor, ruleSet) {
  const { width, height, tag } = descriptor;
  if (!['iframe', 'ins'].includes(tag)) return false;
  return ruleSet.sizes.some(([w, h]) => Math.abs(width - w) <= 2 && Math.abs(height - h) <= 2);
}

export function matchElement(descriptor, ruleSet) {
  if (!descriptor || !ruleSet) return null;
  for (const url of [descriptor.src, descriptor.href]) {
    if (url && shouldBlockUrl(url, ruleSet)) return { reason: 'url', rule: matchUrl(url, ruleSet) };
  }
  const tokens = `${descriptor.className || ''} ${descriptor.id || ''}`.toLowerCase().split(/\s+/);
  if (tokens.some((token) => ruleSet.classPatterns.some((pattern) => pattern.test(token)))) {
    return { reason: 'class' };
  }
  return matchesSize(descriptor, ruleSet) ? { reason: 'size' } : null;
}
