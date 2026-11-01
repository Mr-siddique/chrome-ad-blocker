const BLOCKED_RESOURCE_TYPES = [
  'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'media', 'websocket', 'other',
];

// DNR resolves by priority, then allow beats block. Host rules outrank the player-resource
// allow rules so an ad-host manifest is still blocked, while heuristic (VAST/VPAID) rules
// do not. Subtitles outrank everything.
export const PRIORITY = { heuristic: 1, allowPlayer: 2, host: 3, allowSubtitle: 4 };

const SUBTITLE_FILTERS = [
  '.vtt^', '.srt^', '.ttml^', '.dfxp^', '/subtitles/', '/subtitle/', '/captions/', '/caption/', '/timedtext/',
];
const PLAYER_FILTERS = ['.mpd^', '.m3u8^', '.ism^', '.m4s^'];

export function ruleToUrlFilter(rule) {
  const wildcardTld = rule.host.endsWith('.*');
  const host = wildcardTld ? rule.host.slice(0, -1) : rule.host;
  if (rule.path) return `||${host}${rule.path}^`;
  return wildcardTld ? `||${host}` : `||${host}^`;
}

function makeRule(id, urlFilter, priority, type, resourceTypes) {
  return {
    id,
    priority,
    action: { type },
    condition: { urlFilter, resourceTypes },
  };
}

function uniqueFilters(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.priority}|${entry.action}|${entry.urlFilter}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectEntries({ filters, vast }) {
  const hostEntries = filters.flatMap((filter) => filter.rules).map((rule) => ({
    urlFilter: ruleToUrlFilter(rule), priority: PRIORITY.host, action: 'block',
  }));
  const vastEntries = vast.signatures.map((signature) => ({
    urlFilter: signature.urlFilter, priority: PRIORITY.heuristic, action: 'block',
  }));
  const allow = (list, priority) => list.map((urlFilter) => ({ urlFilter, priority, action: 'allow' }));
  return [
    ...hostEntries,
    ...vastEntries,
    ...allow(PLAYER_FILTERS, PRIORITY.allowPlayer),
    ...allow(SUBTITLE_FILTERS, PRIORITY.allowSubtitle),
  ];
}

export function buildStreamingRules(sources) {
  return uniqueFilters(collectEntries(sources)).map((entry, index) =>
    makeRule(index + 1, entry.urlFilter, entry.priority, entry.action, BLOCKED_RESOURCE_TYPES)
  );
}

export { BLOCKED_RESOURCE_TYPES };
