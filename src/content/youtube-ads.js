import { MSG, sendMessage } from '../utils/messaging.js';
import { CONFIG_TYPE, EVENT_TYPE } from '../youtube/main-world.js';

export const PLATFORM_ID = 'youtube';
export const MAX_PLAYBACK_RATE = 16;
export const RETRY_MS = 250;

const PLAYER = '.html5-video-player';
const SKIP_BUTTONS =
  '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button';
// The overlay container only hosts banner ads over content, so it is hidden but never treated
// as "a video ad is playing" (that would mute and seek real content).
const VIDEO_AD_MARKERS = '.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout';
export const HIDE_SELECTORS = [
  '.ytp-ad-overlay-container', '#masthead-ad', 'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer',
  'ytd-display-ad-renderer', 'ytd-promoted-sparkles-web-renderer', '#player-ads',
];

export function isYoutubeHost(hostname) {
  return /(^|\.)youtube\.com$/.test(String(hostname || '').toLowerCase());
}

export function injectHideStyle(doc) {
  const style = doc.createElement('style');
  style.id = 'sab-youtube-hide';
  style.textContent = `${HIDE_SELECTORS.join(',\n')} { display: none !important; }`;
  (doc.head || doc.documentElement).appendChild(style);
  return style;
}

export function isAdActive(player) {
  return player.classList.contains('ad-showing') || Boolean(player.querySelector(VIDEO_AD_MARKERS));
}

function reportBlock(reason) {
  sendMessage({
    type: MSG.AD_BLOCKED,
    platform: PLATFORM_ID,
    items: [{ reason, domain: 'youtube.com', tag: 'video' }],
  });
}

function fastForward(video, saved) {
  if (!saved.taken) Object.assign(saved, { taken: true, muted: video.muted, rate: video.playbackRate });
  video.muted = true;
  video.playbackRate = MAX_PLAYBACK_RATE;
  const { duration, currentTime } = video;
  if (Number.isFinite(duration) && duration > 0 && currentTime < duration) video.currentTime = duration;
}

function restore(video, saved) {
  if (video && saved.taken) {
    video.muted = saved.muted;
    video.playbackRate = saved.rate;
  }
  saved.taken = false;
}

// Handles one player. tick() is idempotent: call it on any mutation or timer.
export function createAdHandler(player, onBlocked = reportBlock) {
  const saved = { taken: false };
  let active = false;
  let video = null;
  return function tick() {
    if (!isAdActive(player)) {
      if (active) restore(video, saved);
      active = false;
      return false;
    }
    video = player.querySelector('video');
    const skip = player.querySelector(SKIP_BUTTONS);
    if (!active) onBlocked(skip ? 'skip' : 'fast-forward');
    active = true;
    if (skip) skip.click();
    else if (video) fastForward(video, saved);
    return true;
  };
}

function watchPlayer(doc, onPlayer) {
  const found = doc.querySelector(PLAYER);
  if (found) return onPlayer(found);
  const lookup = new MutationObserver(() => {
    const player = doc.querySelector(PLAYER);
    if (!player) return;
    lookup.disconnect();
    onPlayer(player);
  });
  lookup.observe(doc.documentElement, { childList: true, subtree: true });
  return lookup;
}

export function observePlayer(win, doc, onBlocked) {
  return watchPlayer(doc, (player) => {
    const tick = createAdHandler(player, onBlocked);
    let timer = null;
    const run = () => {
      try {
        const adPlaying = tick();
        if (adPlaying && !timer) timer = win.setInterval(run, RETRY_MS);
        if (!adPlaying && timer) { win.clearInterval(timer); timer = null; }
      } catch (error) {
        return;
      }
    };
    const observer = new MutationObserver(run);
    observer.observe(player, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    run();
    return observer;
  });
}

// The MAIN-world script cannot talk to the extension; it posts here and we count one block.
export function relayStripEvents(win) {
  win.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== win || !data || data.source !== EVENT_TYPE || !Number.isInteger(data.removed)) return;
    sendMessage({
      type: MSG.AD_BLOCKED,
      platform: PLATFORM_ID,
      items: [{ reason: 'response-strip', domain: 'youtube.com', tag: 'player-response' }],
    });
  });
}

export async function startYoutubeAds(win = window, doc = document) {
  if (!isYoutubeHost(win.location.hostname)) return null;
  const state = await sendMessage({ type: MSG.GET_BLOCKING_STATE, hostname: win.location.hostname });
  // If the background is unreachable, keep blocking: that is the safe default.
  if (state.ok && state.enabled === false) {
    win.postMessage({ source: CONFIG_TYPE, enabled: false }, win.location.origin);
    return null;
  }
  injectHideStyle(doc);
  relayStripEvents(win);
  return observePlayer(win, doc, reportBlock);
}
