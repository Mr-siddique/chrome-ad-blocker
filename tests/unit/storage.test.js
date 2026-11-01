import * as storage from '../../src/utils/storage.js';

describe('normalizeDomain', () => {
  it.each([
    ['Example.COM', 'example.com'],
    ['https://www.example.com/path?x=1', 'www.example.com'],
    ['*.example.com', 'example.com'],
    ['example.com:8080', 'example.com'],
    ['  sub.example.co.uk  ', 'sub.example.co.uk'],
  ])('%s -> %s', (input, expected) => {
    expect(storage.normalizeDomain(input)).toBe(expected);
  });

  it.each([[''], ['localhost'], ['bad domain.com'], [null], [42], ['.com'], ['a..com']])('rejects %p', (input) => {
    expect(storage.normalizeDomain(input)).toBeNull();
  });
});

describe('whitelist and blacklist', () => {
  it('starts empty', async () => {
    expect(await storage.getWhitelist()).toEqual([]);
    expect(await storage.getBlacklist()).toEqual([]);
  });

  it('adds, dedupes, matches subdomains and removes', async () => {
    expect((await storage.addToWhitelist('Example.com')).ok).toBe(true);
    await storage.addToWhitelist('https://example.com/x');
    expect(await storage.getWhitelist()).toEqual(['example.com']);
    expect(await storage.isWhitelisted('www.example.com')).toBe(true);
    expect(await storage.isWhitelisted('notexample.com')).toBe(false);
    expect(await storage.isWhitelisted('garbage')).toBe(false);
    await storage.removeFromWhitelist('example.com');
    await storage.removeFromWhitelist('example.com');
    expect(await storage.getWhitelist()).toEqual([]);
  });

  it('writes the whitelist to chrome.storage.sync only', async () => {
    await storage.addToWhitelist('example.com');
    expect(chrome.storage.sync.set).toHaveBeenCalled();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('rejects invalid domains with a message', async () => {
    expect(await storage.addToWhitelist('???')).toEqual({ ok: false, error: 'Invalid domain' });
    expect(await storage.removeFromBlacklist('')).toEqual({ ok: false, error: 'Invalid domain' });
  });

  it('keeps whitelist and blacklist mutually exclusive', async () => {
    await storage.addToWhitelist('a.com');
    await storage.addToBlacklist('a.com');
    expect(await storage.getWhitelist()).toEqual([]);
    expect(await storage.getBlacklist()).toEqual(['a.com']);
    await storage.addToWhitelist('a.com');
    expect(await storage.getBlacklist()).toEqual([]);
  });

  it('ignores malformed stored data', async () => {
    await chrome.storage.sync.set({ 'whitelist.n': 2, 'whitelist.0': 'oops', 'whitelist.1': ['ok.com', 5] });
    expect(await storage.getWhitelist()).toEqual(['ok.com']);
  });
});

describe('settings', () => {
  it('returns defaults when storage is empty', async () => {
    expect(await storage.getSettings()).toEqual(storage.DEFAULT_SETTINGS);
  });

  it('falls back to defaults when storage reads fail', async () => {
    chrome.storage.sync.get.mockRejectedValue(new Error('boom'));
    expect(await storage.getSettings()).toEqual(storage.DEFAULT_SETTINGS);
    expect(await storage.getWhitelist()).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('falls back to defaults when stored settings are garbage', async () => {
    await chrome.storage.sync.set({ settings: 'garbage' });
    expect(await storage.getSettings()).toEqual(storage.DEFAULT_SETTINGS);
  });

  it('persists a change across a simulated reload and merges categories', async () => {
    await storage.saveSettings({ categories: { scripts: false } });
    jest.resetModules();
    const reloaded = require('../../src/utils/storage.js');
    const settings = await reloaded.getSettings();
    expect(settings.categories).toEqual({ images: true, scripts: false, iframes: true });
  });

  it('resets to defaults', async () => {
    await storage.saveSettings({ enabled: false, categories: { images: false } });
    const result = await storage.resetSettings();
    expect(result.value).toEqual(storage.DEFAULT_SETTINGS);
  });

  it('reports non-quota write failures', async () => {
    chrome.storage.sync.set.mockRejectedValue(new Error('disk gone'));
    expect(await storage.saveSettings({ enabled: false })).toEqual({ ok: false, error: 'disk gone' });
  });
});

describe('blocking decision', () => {
  it('is on by default', async () => {
    expect(await storage.isBlockingEnabledFor('example.com')).toBe(true);
  });

  it('is off for whitelisted domains, on for blacklisted ones even when disabled', async () => {
    await storage.addToWhitelist('white.com');
    await storage.addToBlacklist('black.com');
    await storage.saveSettings({ enabled: false });
    expect(await storage.isBlockingEnabledFor('www.white.com')).toBe(false);
    expect(await storage.isBlockingEnabledFor('black.com')).toBe(true);
    expect(await storage.isBlockingEnabledFor('other.com')).toBe(false);
  });

  it('honours the session disable flag', async () => {
    await storage.setSessionDisabled(true);
    expect(await storage.isSessionDisabled()).toBe(true);
    expect(await storage.isBlockingEnabledFor('example.com')).toBe(false);
    await storage.setSessionDisabled(false);
    expect(await storage.isBlockingEnabledFor('example.com')).toBe(true);
  });
});

describe('health and stats', () => {
  it('defaults to healthy and stores health in local storage', async () => {
    expect(await storage.getHealth()).toEqual({ ok: true, error: null });
    await storage.setHealth({ ok: false, error: 'x' });
    expect(await storage.getHealth()).toEqual({ ok: false, error: 'x' });
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  it('accumulates stats per day, platform and domain in local storage', async () => {
    const now = Date.UTC(2026, 0, 5);
    await storage.recordBlocked({ platform: 'prime-video', count: 2, domain: 'a.com', now });
    await storage.recordBlocked({ platform: 'jio-hotstar', domain: 'b.com', now });
    await storage.recordBlocked({ now: now + 86400000 });
    const stats = await storage.getBlockedStats();
    expect(stats.total).toBe(4);
    expect(stats.days['2026-01-05'].byPlatform).toEqual({ 'prime-video': 2, 'jio-hotstar': 1 });
    expect(stats.days['2026-01-06'].byPlatform).toEqual({ general: 1 });
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  it('keeps at most 90 days of stats', async () => {
    for (let day = 0; day < 95; day += 1) {
      await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 1) + day * 86400000 });
    }
    expect(Object.keys((await storage.getBlockedStats()).days)).toHaveLength(90);
  });

  it('returns zero stats on read failure or garbage', async () => {
    await chrome.storage.local.set({ statsDaily: 'garbage' });
    expect(await storage.getBlockedStats()).toEqual({ total: 0, days: {} });
  });
});
