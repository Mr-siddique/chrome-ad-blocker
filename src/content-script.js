import { detectPlatform, getPlatformContext } from './content/platform-detect.js';
import { observeAds } from './content/player-ads.js';

// Stub contract: T10 replaces this with the typed messaging module.
function reportBlocked(platform, items) {
  try {
    const result = chrome.runtime.sendMessage({ type: 'AD_BLOCKED', platform, items });
    if (result && result.catch) result.catch(() => {});
  } catch (error) {
    // Extension context can be invalidated on update; blocking must keep working.
  }
}

export function start(win = window, doc = document) {
  const platform = detectPlatform(win.location);
  const context = getPlatformContext(platform);
  if (!context) return null;
  const onRemoved = (items) => reportBlocked(platform, items);
  return observeAds(doc.documentElement, context, onRemoved);
}

start();
