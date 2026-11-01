const MAX_PATTERN_LENGTH = 200;
const HOST_PATTERN = /^[a-z0-9*.-]+$/;
const PATH_PATTERN = /^\/[a-z0-9/_.~%-]*$/i;
const LABEL = '[a-z0-9-]+';
// Trailing wildcard stands for a TLD: com, de, co.uk, com.au. Not arbitrary labels,
// so lookalikes such as primevideo.com.evil cannot match.
const TLD = '(?:[a-z]{2,}|(?:co|com)\\.[a-z]{2})';

function escapeLiteral(text) {
  return text.replace(/[.+?^${}()|[\]\\-]/g, '\\$&');
}

export function hostToRegExp(host) {
  const labels = host.toLowerCase().split('.');
  const parts = labels.map((label, index) => {
    if (label === '*' && index === labels.length - 1 && labels.length > 1) return TLD;
    return label.split('*').map(escapeLiteral).join(LABEL);
  });
  return new RegExp(`^(?:${LABEL}\\.)*${parts.join('\\.')}$`);
}

export function parsePattern(input) {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase().replace(/^\|\|/, '').replace(/^https?:\/\//, '');
  const slash = cleaned.indexOf('/');
  const host = slash === -1 ? cleaned : cleaned.slice(0, slash);
  const path = slash === -1 ? '' : cleaned.slice(slash);
  return { host, path };
}

function hostError(host) {
  if (!host) return 'Pattern must include a host such as ads.example.com';
  if (!HOST_PATTERN.test(host)) return 'Host contains invalid characters';
  const labels = host.split('.');
  if (labels.length < 2 || labels.some((label) => label === '')) {
    return 'Host must have at least two non-empty labels';
  }
  const specific = labels.slice(0, -1).some((label) => label.replace(/\*/g, '').length >= 2);
  if (!specific) return 'Pattern is too broad: it would match unrelated sites';
  return null;
}

export function validatePattern(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return { valid: false, error: 'Pattern is empty' };
  }
  if (input.length > MAX_PATTERN_LENGTH) return { valid: false, error: 'Pattern is too long' };
  if (/\s/.test(input.trim())) return { valid: false, error: 'Pattern must not contain spaces' };
  const { host, path } = parsePattern(input);
  const error = hostError(host);
  if (error) return { valid: false, error };
  if (path && !PATH_PATTERN.test(path)) return { valid: false, error: 'Path contains invalid characters' };
  return { valid: true, error: null };
}
