import { getBannerContext, BANNER_PLATFORM } from './banner-ads.js';
import { detectPlatform, getPlatformContext } from './platform-detect.js';
import { observeAds } from './player-ads.js';
import { MSG, sendMessage } from '../utils/messaging.js';

// Page-level hostname: in a cross-origin frame the last ancestor origin is the top page.
export function getTopHostname(win) {
  const origins = win.location.ancestorOrigins;
  if (origins && origins.length) {
    try {
      return new URL(origins[origins.length - 1]).hostname;
    } catch (error) {
      return win.location.hostname;
    }
  }
  return win.location.hostname;
}

// Streaming pages use the platform list only (streaming takes precedence); every other page
// gets general banner rules.
export function pickContext(win) {
  const platform = detectPlatform(win.location);
  if (platform) return { platform, context: getPlatformContext(platform) };
  return { platform: BANNER_PLATFORM, context: getBannerContext() };
}

export async function start(win = window, doc = document) {
  const { platform, context } = pickContext(win);
  sendMessage({ type: MSG.PAGE_START, topFrame: win === win.top });
  const state = await sendMessage({ type: MSG.GET_BLOCKING_STATE, hostname: getTopHostname(win) });
  // If the background is unreachable, keep blocking: that is the safe default.
  if (state.ok && state.enabled === false) return null;
  const onRemoved = (items) => sendMessage({ type: MSG.AD_BLOCKED, platform, items });
  return observeAds(doc.documentElement, { ...context, categories: state.categories }, onRemoved);
}
