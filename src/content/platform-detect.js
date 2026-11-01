import { JIO_HOTSTAR_FILTER, JIO_HOTSTAR_RULE_SET } from '../filters/jio-hotstar.js';
import { PRIME_VIDEO_FILTER, PRIME_VIDEO_RULE_SET } from '../filters/prime-video.js';
import { hostToRegExp } from '../utils/patterns.js';

export const PLATFORMS = {
  'prime-video': { filter: PRIME_VIDEO_FILTER, ruleSet: PRIME_VIDEO_RULE_SET },
  'jio-hotstar': { filter: JIO_HOTSTAR_FILTER, ruleSet: JIO_HOTSTAR_RULE_SET },
};

function onHost(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function matchesPlatform(filter, host, pathname) {
  if (filter.platformHosts.some((domain) => onHost(host, domain))) return true;
  return filter.platformPaths.some(
    (entry) => hostToRegExp(entry.hostPattern).test(host) && pathname.startsWith(entry.path)
  );
}

export function detectPlatform(locationLike) {
  if (!locationLike || !locationLike.hostname) return null;
  const host = locationLike.hostname.toLowerCase();
  const pathname = locationLike.pathname || '/';
  const found = Object.keys(PLATFORMS).find((id) => matchesPlatform(PLATFORMS[id].filter, host, pathname));
  return found || null;
}

export function getPlatformContext(platform) {
  return PLATFORMS[platform] || null;
}
