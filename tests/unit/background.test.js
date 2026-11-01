import { HEALTH_KEY, loadBundledFilters, shouldBlockRequest, validateFilterList } from '../../src/utils/rules-loader.js';

const goodFilter = { id: 'x', version: '1', rules: [{ id: 'r1', host: 'ads.example.com' }] };

function loadBackground() {
  let background;
  jest.isolateModules(() => {
    background = require('../../src/background.js');
  });
  return background;
}

describe('rules-loader', () => {
  it('loads the bundled lists', () => {
    const bundle = loadBundledFilters();
    expect(bundle.ok).toBe(true);
    expect(bundle.ruleSet.size).toBeGreaterThan(80);
    expect(shouldBlockRequest('https://ads.jiohotstar.com/x', bundle)).toBe(true);
    expect(shouldBlockRequest('https://example.com/vast.xml', bundle)).toBe(true);
    expect(shouldBlockRequest('https://example.com/', bundle)).toBe(false);
  });

  it.each([
    [null], [{}], [{ id: 'a', version: '1' }], [{ id: 'a', version: '1', rules: [] }],
    [{ id: 'a', version: '1', rules: [{ id: 'bad', host: '*' }] }],
    [{ id: 'a', version: '1', rules: [null] }],
  ])('rejects corrupted list %j', (filter) => {
    expect(validateFilterList(filter)).toEqual(expect.any(String));
    const bundle = loadBundledFilters([goodFilter, filter]);
    expect(bundle.ok).toBe(false);
    expect(bundle.ruleSet).toBeNull();
    expect(shouldBlockRequest('https://ads.example.com/', bundle)).toBe(false);
  });

  it('accepts a valid list and reports exceptions as failures', () => {
    expect(validateFilterList(goodFilter)).toBeNull();
    expect(loadBundledFilters(null).ok).toBe(false);
    expect(shouldBlockRequest('https://ads.example.com/', null)).toBe(false);
  });
});

describe('background service worker', () => {
  it('registers install and startup listeners and records healthy state on wake', async () => {
    loadBackground();
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
    await flushPromises();
    expect(chrome.storage.local._data[HEALTH_KEY].ok).toBe(true);
    expect(chrome.declarativeNetRequest.updateEnabledRulesets).not.toHaveBeenCalled();
    expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
  });

  it('onInstalled and onStartup re-run initialization', async () => {
    loadBackground();
    await flushPromises();
    chrome.storage.local.set.mockClear();
    chrome.runtime.onInstalled.emit();
    chrome.runtime.onStartup.emit();
    await flushPromises();
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(2);
  });

  it('disables blocking, warns on the badge and does not throw when the list is corrupted', async () => {
    const { initialize } = loadBackground();
    await flushPromises();
    const health = await initialize(() => ({ ok: false, error: 'corrupt', ruleSet: null }));
    expect(health.ok).toBe(false);
    expect(chrome.declarativeNetRequest.updateEnabledRulesets).toHaveBeenCalledWith({
      disableRulesetIds: ['streaming'],
    });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '!' });
    expect(chrome.storage.local._data[HEALTH_KEY]).toMatchObject({ ok: false, error: 'corrupt' });
    expect(console.error).toHaveBeenCalled();
  });

  it('survives ruleset and storage API failures', async () => {
    const { initialize } = loadBackground();
    await flushPromises();
    chrome.declarativeNetRequest.updateEnabledRulesets.mockRejectedValue(new Error('no ruleset'));
    chrome.storage.local.set.mockRejectedValue(new Error('quota'));
    await expect(initialize(() => ({ ok: false, error: 'x', ruleSet: null }))).resolves.toMatchObject({ ok: false });
  });

  it('initializes within the 200 ms filter-load target (p95 over 30 cold starts)', () => {
    const times = [];
    for (let i = 0; i < 30; i += 1) {
      const start = performance.now();
      jest.isolateModules(() => {
        require('../../src/utils/rules-loader.js').loadBundledFilters();
      });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length * 0.95) - 1]).toBeLessThan(200);
  });
});
