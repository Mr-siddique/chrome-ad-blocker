import { MSG } from '../../src/utils/messaging.js';
import * as storage from '../../src/utils/storage.js';

// Wires chrome.runtime.sendMessage to the background onMessage listeners, like the browser does.
function connect(tabId = 1) {
  chrome.runtime.sendMessage = jest.fn((message) =>
    new Promise((resolve) => {
      const sender = tabId == null ? {} : { tab: { id: tabId } };
      chrome.runtime.onMessage.emit(message, sender, resolve);
    })
  );
}

function loadBackground() {
  let background;
  jest.isolateModules(() => {
    background = require('../../src/background.js');
  });
  return background;
}

function loadContentScript() {
  let contentScript;
  jest.isolateModules(() => {
    contentScript = require('../../src/content/runner.js');
  });
  return contentScript;
}

const prime = { location: { hostname: 'www.primevideo.com', pathname: '/' } };

describe('content script <-> background <-> storage', () => {
  beforeEach(async () => {
    loadBackground();
    connect();
    await flushPromises();
    document.body.innerHTML = '';
  });

  it('removes ads, counts them per tab, updates the badge and records stats', async () => {
    document.body.innerHTML = '<video src="blob:x"></video><div class="ad-overlay"></div><div class="ad-banner"></div>';
    const observer = await loadContentScript().start(prime, document);
    await flushPromises();
    const response = await chrome.runtime.sendMessage({ type: MSG.GET_TAB_STATS, tabId: 1 });
    expect(response.stats.count).toBe(2);
    expect(response.stats.byPlatform).toEqual({ 'prime-video': 2 });
    expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ tabId: 1, text: '2' });
    expect((await storage.getBlockedStats()).total).toBe(2);
    expect(document.querySelector('video')).not.toBeNull();
    observer.disconnect();
  });

  it('skips all work on a whitelisted domain', async () => {
    await chrome.runtime.sendMessage({ type: MSG.SET_WHITELIST, domain: 'primevideo.com', whitelisted: true });
    document.body.innerHTML = '<div class="ad-overlay"></div>';
    const observer = await loadContentScript().start(prime, document);
    expect(observer).toBeNull();
    expect(document.querySelector('.ad-overlay')).not.toBeNull();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: MSG.AD_BLOCKED }));
    expect((await chrome.declarativeNetRequest.getDynamicRules())[0].action.type).toBe('allowAllRequests');
  });

  it('blocks a blacklisted domain even when blocking is disabled', async () => {
    await chrome.runtime.sendMessage({ type: MSG.SET_DISABLED, disabled: true, scope: 'permanent' });
    await chrome.runtime.sendMessage({ type: MSG.SET_BLACKLIST, domain: 'primevideo.com', blacklisted: true });
    document.body.innerHTML = '<div class="ad-overlay"></div>';
    const observer = await loadContentScript().start(prime, document);
    expect(document.querySelector('.ad-overlay')).toBeNull();
    observer.disconnect();
  });

  it('re-enables after un-whitelisting and removes the dynamic rule', async () => {
    await chrome.runtime.sendMessage({ type: MSG.SET_WHITELIST, domain: 'primevideo.com', whitelisted: true });
    await chrome.runtime.sendMessage({ type: MSG.SET_WHITELIST, domain: 'primevideo.com', whitelisted: false });
    expect(await chrome.declarativeNetRequest.getDynamicRules()).toEqual([]);
    expect((await chrome.runtime.sendMessage({ type: MSG.GET_BLOCKING_STATE, hostname: 'primevideo.com' })).enabled).toBe(true);
  });

  it('isolates two tabs', async () => {
    connect(1);
    await chrome.runtime.sendMessage({ type: MSG.AD_BLOCKED, platform: 'prime-video', items: [{ domain: 'a.com' }] });
    connect(2);
    await chrome.runtime.sendMessage({ type: MSG.AD_BLOCKED, platform: 'jio-hotstar', items: [{ domain: 'b.com' }, {}] });
    expect((await chrome.runtime.sendMessage({ type: MSG.GET_TAB_STATS, tabId: 1 })).stats.count).toBe(1);
    expect((await chrome.runtime.sendMessage({ type: MSG.GET_TAB_STATS, tabId: 2 })).stats.byPlatform).toEqual({ 'jio-hotstar': 2 });
  });

  it('resets the tab count when the tab starts loading, not on page start or sub-frames', async () => {
    await chrome.runtime.sendMessage({ type: MSG.AD_BLOCKED, platform: 'prime-video', items: [{}] });
    await chrome.runtime.sendMessage({ type: MSG.PAGE_START, topFrame: false });
    await chrome.runtime.sendMessage({ type: MSG.PAGE_START, topFrame: true });
    expect((await chrome.runtime.sendMessage({ type: MSG.GET_TAB_STATS, tabId: 1 })).stats.count).toBe(1);
    chrome.tabs.onUpdated.emit(1, { status: 'loading' });
    await flushPromises();
    expect((await chrome.runtime.sendMessage({ type: MSG.GET_TAB_STATS, tabId: 1 })).stats.count).toBe(0);
    expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ tabId: 1, text: '' });
  });

  it('keeps per-tab state across a service worker restart', async () => {
    await chrome.runtime.sendMessage({ type: MSG.AD_BLOCKED, platform: 'prime-video', items: [{}, {}] });
    chrome.runtime.onMessage = makeChromeMock().runtime.onMessage;
    loadBackground();
    await flushPromises();
    const response = await chrome.runtime.sendMessage({ type: MSG.GET_TAB_STATS, tabId: 1 });
    expect(response.stats.count).toBe(2);
  });

  it('builds the popup state with platform labels and the blocked-domain list', async () => {
    await chrome.runtime.sendMessage({
      type: MSG.AD_BLOCKED, platform: 'prime-video', items: [{ domain: 'a.com' }, { domain: 'a.com' }, { domain: 'b.com' }],
    });
    const state = await chrome.runtime.sendMessage({ type: MSG.GET_POPUP_STATE, tabId: 1, hostname: 'primevideo.com' });
    expect(state.labels).toEqual([{ platform: 'prime-video', count: 3, text: 'Blocked 3 Prime Video ads' }]);
    expect(state.stats.domains[0]).toEqual({ domain: 'a.com', count: 2 });
    expect(state).toMatchObject({ whitelisted: false, blacklisted: false, sessionDisabled: false });
    expect(state.health.ok).toBe(true);
  });

  it('session disable turns rulesets off and clears on browser startup; permanent persists', async () => {
    await chrome.runtime.sendMessage({ type: MSG.SET_DISABLED, disabled: true, scope: 'session' });
    expect(chrome.declarativeNetRequest.updateEnabledRulesets).toHaveBeenLastCalledWith({ disableRulesetIds: ['streaming', 'general'] });
    chrome.runtime.onStartup.emit();
    await flushPromises();
    expect(await storage.isSessionDisabled()).toBe(false);
    expect(chrome.declarativeNetRequest.updateEnabledRulesets).toHaveBeenLastCalledWith({ enableRulesetIds: ['streaming', 'general'] });
    await chrome.runtime.sendMessage({ type: MSG.SET_DISABLED, disabled: true, scope: 'permanent' });
    chrome.runtime.onStartup.emit();
    await flushPromises();
    expect((await storage.getSettings()).enabled).toBe(false);
    expect(chrome.declarativeNetRequest.updateEnabledRulesets).toHaveBeenLastCalledWith({ disableRulesetIds: ['streaming', 'general'] });
    await chrome.runtime.sendMessage({ type: MSG.SET_DISABLED, disabled: false, scope: 'permanent' });
    expect((await storage.getSettings()).enabled).toBe(true);
  });

  it('rejects malformed messages and messages from tab-less senders', async () => {
    expect(await chrome.runtime.sendMessage({ type: 'NOPE' })).toMatchObject({ ok: false });
    connect(null);
    expect(await chrome.runtime.sendMessage({ type: MSG.AD_BLOCKED, platform: 'p', items: [] })).toEqual({ ok: false, error: 'No tab' });
    expect(await chrome.runtime.sendMessage({ type: MSG.PAGE_START, topFrame: true })).toEqual({ ok: true });
  });

  it('returns an error response instead of throwing when a handler fails', async () => {
    chrome.declarativeNetRequest.updateDynamicRules.mockRejectedValue(new Error('rules rejected'));
    const response = await chrome.runtime.sendMessage({ type: MSG.SET_WHITELIST, domain: 'a.com', whitelisted: true });
    expect(response).toEqual({ ok: false, error: 'rules rejected' });
    expect(console.error).toHaveBeenCalled();
  });

  it('closing a tab drops its stats', async () => {
    await chrome.runtime.sendMessage({ type: MSG.AD_BLOCKED, platform: 'prime-video', items: [{}] });
    chrome.tabs.onRemoved.emit(1);
    expect((await chrome.runtime.sendMessage({ type: MSG.GET_TAB_STATS, tabId: 1 })).stats.count).toBe(0);
  });
});

describe('network-level blocks reach the badge and popup state', () => {
  const streaming = require('../../src/rules/streaming-rules.json');
  const primeRule = streaming.find((r) => r.condition.urlFilter.startsWith('||aiv-cdn.amazon.com'));

  beforeEach(async () => {
    loadBackground();
    connect();
    await flushPromises();
  });

  it('counts getMatchedRules hits in popup stats, per-platform label and badge', async () => {
    chrome.tabs.onUpdated.emit(1, { status: 'loading' });
    const now = Date.now();
    chrome.declarativeNetRequest.getMatchedRules.mockResolvedValue({
      rulesMatchedInfo: [{ rule: { rulesetId: 'streaming', ruleId: primeRule.id }, timeStamp: now + 10 }],
    });
    const state = await chrome.runtime.sendMessage({ type: MSG.GET_POPUP_STATE, tabId: 1, hostname: 'www.primevideo.com' });
    expect(state.stats.count).toBe(1);
    expect(state.stats.byPlatform).toEqual({ 'prime-video': 1 });
    expect(state.labels[0].text).toBe('Blocked 1 Prime Video ad');
    expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ tabId: 1, text: '1' });
  });

  it('polls again when the tab finishes loading', async () => {
    chrome.declarativeNetRequest.getMatchedRules.mockClear();
    chrome.tabs.onUpdated.emit(1, { status: 'complete' });
    await flushPromises();
    expect(chrome.declarativeNetRequest.getMatchedRules).toHaveBeenCalled();
  });

  it('ignores invalid tab ids', async () => {
    const { syncNetworkBlocks } = loadBackground();
    chrome.declarativeNetRequest.getMatchedRules.mockClear();
    await syncNetworkBlocks(-1);
    await syncNetworkBlocks(undefined);
    expect(chrome.declarativeNetRequest.getMatchedRules).not.toHaveBeenCalled();
  });
});
