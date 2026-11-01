import fs from 'fs';
import path from 'path';
import { getBannerContext } from '../../src/content/banner-ads.js';
import { PLATFORMS } from '../../src/content/platform-detect.js';
import { observeAds, removeAdElements } from '../../src/content/player-ads.js';
import { MSG } from '../../src/utils/messaging.js';
import * as storage from '../../src/utils/storage.js';
import { parseImport } from '../../src/utils/import-export.js';
import { createMockPlayer } from '../harness/mock-player.js';

const SRC = path.resolve(__dirname, '../../src');
const popupHtml = fs.readFileSync(path.join(SRC, 'popup.html'), 'utf8');
const prime = { location: { hostname: 'www.primevideo.com', pathname: '/' } };

function loadModule(file) {
  let mod;
  jest.isolateModules(() => {
    mod = require(path.join(SRC, file));
  });
  return mod;
}

function loadBackground() {
  return loadModule('background.js');
}

function connect(tabId = 1) {
  chrome.runtime.sendMessage = jest.fn((message) =>
    new Promise((resolve) => {
      chrome.runtime.onMessage.emit(message, { tab: { id: tabId } }, resolve);
    })
  );
}

const send = (message) => chrome.runtime.sendMessage(message);

beforeEach(async () => {
  console.error.mockClear();
  document.body.innerHTML = '';
  loadBackground();
  connect();
  await flushPromises();
});

describe('edge case: bundled filter file missing or corrupted', () => {
  async function corruptAndBoot() {
    const { initialize } = loadBackground();
    await flushPromises();
    await initialize(() => ({ ok: false, error: 'bundled list corrupted', ruleSet: null }));
  }

  it('disables blocking, shows a badge warning, logs an error and does not crash', async () => {
    await corruptAndBoot();
    expect(chrome.declarativeNetRequest.updateEnabledRulesets).toHaveBeenCalledWith({
      disableRulesetIds: ['streaming', 'general'],
    });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '!' });
    expect(console.error).toHaveBeenCalled();
  });

  it('shows the warning in the popup', async () => {
    await corruptAndBoot();
    document.body.innerHTML = new DOMParser().parseFromString(popupHtml, 'text/html').body.innerHTML;
    chrome.tabs.query = jest.fn(async () => [{ id: 1, url: 'https://www.primevideo.com/' }]);
    await loadModule('popup.js').init(document);
    expect(document.getElementById('warning').hidden).toBe(false);
  });

  it('stops DOM removal too, so unrelated content is never touched', async () => {
    await corruptAndBoot();
    document.body.innerHTML = '<div class="ad-overlay"></div>';
    const observer = await loadModule('content/runner.js').start(prime, document);
    expect(observer).toBeNull();
    expect(document.querySelector('.ad-overlay')).not.toBeNull();
  });

  it('survives badge and ruleset API failures', async () => {
    const { initialize } = loadBackground();
    await flushPromises();
    chrome.action.setBadgeText.mockRejectedValue(new Error('no action'));
    chrome.declarativeNetRequest.updateEnabledRulesets.mockRejectedValue(new Error('no rulesets'));
    await expect(initialize(() => ({ ok: false, error: 'x', ruleSet: null }))).resolves.toMatchObject({ ok: false });
  });
});

describe('edge case: imported block list malformed or with invalid patterns', () => {
  it('rejects a malformed import and leaves existing rules intact', async () => {
    await storage.addCustomPattern('ads.example.com');
    const before = await storage.getRuleSet();
    expect(parseImport('{broken').ok).toBe(false);
    expect(await storage.getRuleSet()).toEqual(before);
  });

  it('skips invalid entries with a count', () => {
    const text = JSON.stringify({
      format: 'streaming-ad-blocker-rules', version: 1, customPatterns: ['*', 'ads.example.com'],
      whitelist: [], blacklist: [], categories: { images: true, scripts: true, iframes: true },
    });
    expect(parseImport(text)).toMatchObject({ ok: true, skipped: 1 });
  });
});

describe('edge case: custom pattern that would match everything', () => {
  it.each([['*'], ['*.*'], ['**'], ['*.com']])('rejects %s with an error message', async (pattern) => {
    const result = await storage.addCustomPattern(pattern);
    expect(result.ok).toBe(false);
    expect(result.error).toEqual(expect.any(String));
    expect(await storage.getCustomPatterns()).toEqual([]);
  });
});

describe('edge case: storage quota and failures', () => {
  it('sync quota exceeded: visible message, whitelist kept, statistics evicted first', async () => {
    await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 1) });
    await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 2) });
    let failure = null;
    for (let i = 0; i < 1500 && !failure; i += 1) {
      const result = await storage.addToWhitelist(`site-${i}-${'x'.repeat(50)}.example.com`);
      if (!result.ok) failure = result;
    }
    expect(failure.error).toMatch(/full/i);
    expect((await storage.getWhitelist()).length).toBeGreaterThan(100);
    expect(Object.keys((await storage.getBlockedStats()).days).length).toBeLessThan(2);
  });

  it('local storage full: oldest statistics evicted, whitelist and settings kept', async () => {
    await storage.addToWhitelist('keep.com');
    await storage.saveSettings({ enabled: false });
    for (let day = 1; day <= 4; day += 1) await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, day) });
    const used = JSON.stringify(chrome.storage.local._data).length;
    await chrome.storage.local.set({ filler: 'x'.repeat(10485760 - used - 40) });
    expect((await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 5) })).ok).toBe(true);
    expect(Object.keys((await storage.getBlockedStats()).days)).not.toContain('2026-01-01');
    expect(await storage.getWhitelist()).toEqual(['keep.com']);
    expect((await storage.getSettings()).enabled).toBe(false);
  });

  it('storage read fails or is empty: bundled defaults are used and blocking stays on', async () => {
    chrome.storage.sync.get.mockRejectedValue(new Error('boom'));
    chrome.storage.local.get.mockRejectedValue(new Error('boom'));
    expect(await storage.getSettings()).toEqual(storage.DEFAULT_SETTINGS);
    expect(await storage.isBlockingEnabledFor('www.primevideo.com')).toBe(true);
    expect((await send({ type: MSG.GET_BLOCKING_STATE, hostname: 'x.com' })).enabled).toBe(true);
  });

  it('empty storage: defaults', async () => {
    expect(await storage.getRuleSet()).toEqual({
      customPatterns: [], whitelist: [], blacklist: [], categories: storage.DEFAULT_SETTINGS.categories,
    });
  });
});

describe('edge case: service worker terminated and restarted mid-session', () => {
  it('resumes within 200 ms with no loss of persisted settings, whitelist or tab counts', async () => {
    await send({ type: MSG.SET_WHITELIST, domain: 'keep.com', whitelisted: true });
    await send({ type: MSG.SET_DISABLED, disabled: true, scope: 'permanent' });
    await send({ type: MSG.AD_BLOCKED, platform: 'prime-video', items: [{}, {}, {}] });
    const start = performance.now();
    chrome.runtime.onMessage = makeChromeMock().runtime.onMessage;
    loadBackground();
    await flushPromises();
    expect(performance.now() - start).toBeLessThan(200);
    expect((await storage.getSettings()).enabled).toBe(false);
    expect(await storage.getWhitelist()).toEqual(['keep.com']);
    expect((await send({ type: MSG.GET_TAB_STATS, tabId: 1 })).stats.count).toBe(3);
  });
});

describe('edge case: whitelisted pages and disabled blocking', () => {
  it('whitelisted page: no blocking or element removal', async () => {
    await send({ type: MSG.SET_WHITELIST, domain: 'primevideo.com', whitelisted: true });
    document.body.innerHTML = '<div class="ad-overlay"></div><iframe src="https://securepubads.g.doubleclick.net/x"></iframe>';
    expect(await loadModule('content/runner.js').start(prime, document)).toBeNull();
    expect(document.body.children).toHaveLength(2);
  });

  it('session disable is cleared at browser startup; permanent persists', async () => {
    await send({ type: MSG.SET_DISABLED, disabled: true, scope: 'session' });
    expect((await send({ type: MSG.GET_BLOCKING_STATE, hostname: 'x.com' })).enabled).toBe(false);
    chrome.runtime.onStartup.emit();
    await flushPromises();
    expect((await send({ type: MSG.GET_BLOCKING_STATE, hostname: 'x.com' })).enabled).toBe(true);
    await send({ type: MSG.SET_DISABLED, disabled: true, scope: 'permanent' });
    chrome.runtime.onStartup.emit();
    await flushPromises();
    expect((await send({ type: MSG.GET_BLOCKING_STATE, hostname: 'x.com' })).enabled).toBe(false);
  });
});

describe('edge case: removal must never hit controls, subtitles or content', () => {
  it.each(['prime-video', 'jio-hotstar'])('%s: an ad-classed wrapper around the player is left alone', (platform) => {
    const player = createMockPlayer(document, platform);
    const wrapper = document.createElement('div');
    wrapper.className = 'ad-container';
    player.root.replaceWith(wrapper);
    wrapper.append(player.root);
    expect(removeAdElements(document.body, PLATFORMS[platform])).toEqual([]);
    expect(player.controlsPresent()).toBe(true);
    expect(player.video.isConnected).toBe(true);
  });

  it('ad-classed controls and subtitles are not removed on general pages either', () => {
    document.body.innerHTML = '<div class="ad-controls"><button>x</button></div><div class="ad-subtitles" aria-live="polite">t</div>';
    expect(removeAdElements(document.body, getBannerContext())).toEqual([]);
  });
});

describe('edge case: player DOM changes structure or is unknown', () => {
  it('never throws on odd nodes and removes nothing it should not', async () => {
    const observer = observeAds(document.body, PLATFORMS['prime-video'], jest.fn());
    document.body.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ad-overlay');
    const shadowHost = document.createElement('div');
    shadowHost.attachShadow({ mode: 'open' }).innerHTML = '<div class="ad-overlay"></div>';
    document.body.append(svg, shadowHost, document.createComment('x'), document.createElement('custom-element'));
    document.body.append(...Array.from({ length: 50 }, (_, i) => Object.assign(document.createElement('section'), { className: `x${i} promo-${i}` })));
    await flushPromises();
    expect(document.body.children.length).toBeGreaterThan(50);
    expect(console.error).not.toHaveBeenCalled();
    observer.disconnect();
  });

  it('swallows an unexpected failure inside the observer callback', async () => {
    const onRemoved = jest.fn(() => {
      throw new Error('callback exploded');
    });
    const observer = observeAds(document.body, PLATFORMS['prime-video'], onRemoved);
    document.body.insertAdjacentHTML('beforeend', '<div class="ad-overlay"></div>');
    await flushPromises();
    expect(onRemoved).toHaveBeenCalled();
    observer.disconnect();
  });

  it('previously unmatched ads keep playing and playback is not broken', async () => {
    const player = createMockPlayer(document, 'prime-video');
    const observer = observeAds(document.body, PLATFORMS['prime-video'], () => {});
    const unknown = player.injectAd('unknown');
    await flushPromises();
    player.advance(3000);
    expect(unknown.isConnected).toBe(true);
    expect(player.state.longestBlankMs).toBe(0);
    expect(player.controlsPresent()).toBe(true);
    observer.disconnect();
  });
});

describe('edge case: ad network domain changes', () => {
  it('unknown domains are not blocked until the bundled list is updated', () => {
    document.body.innerHTML = '<iframe src="https://brand-new-adnetwork.example.net/serve"></iframe>';
    expect(removeAdElements(document.body, PLATFORMS['prime-video'])).toEqual([]);
  });
});

describe('edge case: popup on non-web tabs and unavailable service worker', () => {
  it('shows "Not available on this page" for chrome:// tabs without errors', async () => {
    document.body.innerHTML = new DOMParser().parseFromString(popupHtml, 'text/html').body.innerHTML;
    chrome.tabs.query = jest.fn(async () => [{ id: 3, url: 'chrome://newtab/' }]);
    await loadModule('popup.js').init(document);
    expect(document.getElementById('unavailable').hidden).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('edge case: multiple tabs on streaming sites', () => {
  it('keeps counts and domain lists per tab', async () => {
    connect(1);
    await send({ type: MSG.AD_BLOCKED, platform: 'prime-video', items: [{ domain: 'a.com' }] });
    connect(2);
    await send({ type: MSG.AD_BLOCKED, platform: 'jio-hotstar', items: [{ domain: 'b.com' }] });
    expect((await send({ type: MSG.GET_TAB_STATS, tabId: 1 })).stats.domains).toEqual([{ domain: 'a.com', count: 1 }]);
    expect((await send({ type: MSG.GET_TAB_STATS, tabId: 2 })).stats.domains).toEqual([{ domain: 'b.com', count: 1 }]);
  });
});

describe('edge case: Chrome offline and no network calls of its own', () => {
  it('keeps blocking from bundled rules and never uses fetch/XHR/WebSocket/sendBeacon', async () => {
    const originalOnline = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false });
    global.fetch = jest.fn();
    const xhr = jest.spyOn(XMLHttpRequest.prototype, 'open');
    navigator.sendBeacon = jest.fn();
    document.body.innerHTML = '<div class="ad-overlay"></div>';
    const observer = await loadModule('content/runner.js').start(prime, document);
    expect(document.querySelector('.ad-overlay')).toBeNull();
    await send({ type: MSG.AD_BLOCKED, platform: 'prime-video', items: [{}] });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
    observer.disconnect();
    xhr.mockRestore();
    Object.defineProperty(Navigator.prototype, 'onLine', originalOnline);
  });

  it('source files contain no network APIs', () => {
    const files = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    });
    walk(SRC);
    for (const file of files) {
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource)\s*\(|new\s+(XMLHttpRequest|WebSocket|EventSource)|\beval\s*\(|new Function/);
    }
  });
});
