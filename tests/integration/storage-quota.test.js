import * as storage from '../../src/utils/storage.js';

const NUMBER_OF_DOMAINS = 1500;
const domainFor = (i) => `site-number-${i}-${'x'.repeat(50)}.example.com`;

describe('storage quotas', () => {
  it('splits a large whitelist into chunks under the 8 KB per-item limit', async () => {
    for (let i = 0; i < 200; i += 1) await storage.addToWhitelist(domainFor(i));
    const syncKeys = Object.keys(chrome.storage.sync._data);
    expect(syncKeys.length).toBeGreaterThan(2);
    for (const key of syncKeys) {
      expect(key.length + JSON.stringify(chrome.storage.sync._data[key]).length).toBeLessThan(8192);
    }
    expect((await storage.getWhitelist()).length).toBe(200);
  });

  it('fills sync storage to the limit, fails gracefully and keeps existing entries', async () => {
    let firstFailure = null;
    let added = 0;
    for (let i = 0; i < NUMBER_OF_DOMAINS && !firstFailure; i += 1) {
      const result = await storage.addToWhitelist(domainFor(i));
      if (result.ok) added += 1;
      else firstFailure = result;
    }
    expect(firstFailure).toEqual({ ok: false, error: expect.stringMatching(/full/i) });
    expect(added).toBeGreaterThan(100);
    const list = await storage.getWhitelist();
    expect(list).toHaveLength(added);
    expect(list).toContain(domainFor(0));
    expect(list).toContain(domainFor(added - 1));
  });

  it('evicts statistics before touching the whitelist when sync is full', async () => {
    await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 1) });
    await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 2) });
    for (let i = 0; i < NUMBER_OF_DOMAINS; i += 1) {
      if (!(await storage.addToWhitelist(domainFor(i))).ok) break;
    }
    expect(Object.keys((await storage.getBlockedStats()).days).length).toBeLessThan(2);
    expect((await storage.getWhitelist()).length).toBeGreaterThan(100);
  });

  it('evicts the oldest statistics when local storage is full, keeping whitelist and settings', async () => {
    await storage.addToWhitelist('keep.com');
    await storage.saveSettings({ enabled: false });
    await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 1) });
    await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 2) });
    await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 3) });
    await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 4) });
    const used = JSON.stringify(chrome.storage.local._data).length;
    await chrome.storage.local.set({ filler: 'x'.repeat(10485760 - used - 40) });
    const result = await storage.recordBlocked({ platform: 'p', now: Date.UTC(2026, 0, 5) });
    const days = Object.keys((await storage.getBlockedStats()).days);
    expect(days).not.toContain('2026-01-01');
    expect(result.ok).toBe(true);
    expect(days).toContain('2026-01-05');
    expect(await storage.getWhitelist()).toEqual(['keep.com']);
    expect((await storage.getSettings()).enabled).toBe(false);
  });

  it('reads and writes settings under 20 ms at p95 over 100 operations', async () => {
    const times = [];
    for (let i = 0; i < 100; i += 1) {
      const start = performance.now();
      if (i % 2) await storage.getSettings();
      else await storage.saveSettings({ enabled: i % 4 === 0 });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    expect(times[94]).toBeLessThan(20);
  });

  it('survives a corrupted chunk count without crashing', async () => {
    await chrome.storage.sync.set({ 'whitelist.n': 'NaN' });
    expect(await storage.getWhitelist()).toEqual([]);
  });
});
