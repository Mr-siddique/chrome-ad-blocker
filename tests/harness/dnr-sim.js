const SEPARATOR = '(?:[^a-z0-9_.%-]|$)';

function escapeChar(char) {
  if (char === '*') return '.*';
  if (char === '^') return SEPARATOR;
  return char.replace(/[.+?${}()|[\]\\/-]/g, '\\$&');
}

// Minimal declarativeNetRequest urlFilter interpreter (|, ||, *, ^), case-insensitive.
export function urlFilterToRegExp(filter) {
  let rest = filter;
  let prefix = '';
  if (rest.startsWith('||')) {
    prefix = '^[a-z][a-z0-9+.-]*:\\/\\/(?:[^/?#]*\\.)?';
    rest = rest.slice(2);
  } else if (rest.startsWith('|')) {
    prefix = '^';
    rest = rest.slice(1);
  }
  const suffix = rest.endsWith('|') ? '$' : '';
  if (suffix) rest = rest.slice(0, -1);
  return new RegExp(prefix + [...rest].map(escapeChar).join('') + suffix, 'i');
}

export function compileRules(rules) {
  return rules.map((rule) => ({ rule, regex: urlFilterToRegExp(rule.condition.urlFilter) }));
}

// Highest priority wins; at equal priority allow beats block, as in Chrome.
export function evaluate(url, compiled) {
  const hits = compiled.filter((entry) => entry.regex.test(url)).map((entry) => entry.rule);
  if (!hits.length) return 'none';
  const top = Math.max(...hits.map((rule) => rule.priority));
  const winners = hits.filter((rule) => rule.priority === top);
  return winners.some((rule) => rule.action.type === 'allow') ? 'allow' : winners[0].action.type;
}

export function isBlockedByDnr(url, compiled) {
  return evaluate(url, compiled) === 'block';
}
