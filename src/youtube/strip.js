// Fields that describe ads inside YouTube player/next responses. Nothing else is touched.
export const AD_KEYS = Object.freeze([
  'adPlacements', 'playerAds', 'adSlots', 'adBreakParams', 'adBreakHeartbeatParams',
]);

export const YT_API_PATTERN = /\/youtubei\/v1\/(player|next)(\?|$|\/)/;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Conservative shape check so unrelated JSON (analytics, app config) is never modified.
export function looksLikePlayerResponse(value) {
  if (!isObject(value) || !isObject(value.responseContext)) return false;
  return AD_KEYS.some((key) => key in value);
}

function stripOne(value) {
  if (!looksLikePlayerResponse(value)) return 0;
  let removed = 0;
  for (const key of AD_KEYS) {
    if (key in value) {
      delete value[key];
      removed += 1;
    }
  }
  return removed;
}

// Strips ad fields in place from a response (or a {playerResponse} wrapper) and returns how many
// fields were removed. Never throws.
export function stripPlayerAds(value) {
  try {
    if (!isObject(value)) return 0;
    const wrapped = isObject(value.playerResponse) ? stripOne(value.playerResponse) : 0;
    return stripOne(value) + wrapped;
  } catch (error) {
    return 0;
  }
}

export function isYoutubeApiUrl(url) {
  return typeof url === 'string' && YT_API_PATTERN.test(url);
}
