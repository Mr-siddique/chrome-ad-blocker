import * as tabStats from '../../src/utils/tab-stats.js';

beforeEach(() => tabStats.clearAllTabs());

describe('tab stats', () => {
  it('returns empty stats for unknown tabs', () => {
    expect(tabStats.getTabStats(99)).toEqual({ count: 0, byPlatform: {}, domains: [] });
  });

  it('accumulates counts, platforms and sorted domains per tab', () => {
    tabStats.recordRemoved(1, 'prime-video', [{ domain: 'b.com' }, { domain: 'a.com' }, { domain: 'a.com' }, {}]);
    tabStats.recordRemoved(1, 'jio-hotstar', [{ domain: 'c.com' }]);
    const stats = tabStats.getTabStats(1);
    expect(stats.count).toBe(5);
    expect(stats.byPlatform).toEqual({ 'prime-video': 4, 'jio-hotstar': 1 });
    expect(stats.domains.map((d) => d.domain)).toEqual(['a.com', 'b.com', 'c.com']);
  });

  it('does not leak between tabs', () => {
    tabStats.recordRemoved(1, 'prime-video', [{ domain: 'a.com' }]);
    tabStats.recordRemoved(2, 'jio-hotstar', [{ domain: 'z.com' }, { domain: 'z.com' }]);
    expect(tabStats.getTabStats(1).count).toBe(1);
    expect(tabStats.getTabStats(1).domains).toEqual([{ domain: 'a.com', count: 1 }]);
    expect(tabStats.getTabStats(2).byPlatform).toEqual({ 'jio-hotstar': 2 });
  });

  it('resets on navigation and drops closed tabs', () => {
    tabStats.recordRemoved(1, 'prime-video', [{}]);
    tabStats.resetTab(1);
    expect(tabStats.getTabStats(1).count).toBe(0);
    tabStats.recordRemoved(1, 'prime-video', [{}]);
    tabStats.removeTab(1);
    expect(tabStats.getTabStats(1).count).toBe(0);
  });

  it('formats platform labels and badge text', () => {
    expect(tabStats.platformLabel('prime-video', 3)).toBe('Blocked 3 Prime Video ads');
    expect(tabStats.platformLabel('jio-hotstar', 1)).toBe('Blocked 1 Jio Hotstar ad');
    expect(tabStats.platformLabel('custom', 0)).toBe('Blocked 0 custom ads');
    expect(tabStats.badgeText(0)).toBe('');
    expect(tabStats.badgeText(7)).toBe('7');
    expect(tabStats.badgeText(1500)).toBe('999+');
  });

  it('persists and restores after a simulated worker restart', async () => {
    tabStats.recordRemoved(4, 'prime-video', [{ domain: 'a.com' }]);
    await tabStats.persistTabStats();
    tabStats.clearAllTabs();
    await tabStats.restoreTabStats();
    expect(tabStats.getTabStats(4).count).toBe(1);
    tabStats.recordRemoved(4, 'prime-video', [{}]);
    await tabStats.restoreTabStats();
    expect(tabStats.getTabStats(4).count).toBe(2);
  });

  it('survives storage errors', async () => {
    chrome.storage.local.set.mockRejectedValue(new Error('x'));
    chrome.storage.local.get.mockRejectedValue(new Error('y'));
    await expect(tabStats.persistTabStats()).resolves.toBeUndefined();
    await expect(tabStats.restoreTabStats()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});

describe('YouTube platform plumbing', () => {
  it('labels, counts and badges YouTube blocks', () => {
    tabStats.recordRemoved(4, 'youtube', [{ domain: 'youtube.com' }, { domain: 'youtube.com' }]);
    const stats = tabStats.getTabStats(4);
    expect(stats.byPlatform).toEqual({ youtube: 2 });
    expect(tabStats.platformLabel('youtube', 2)).toBe('Blocked 2 YouTube ads');
    expect(tabStats.platformLabel('youtube', 1)).toBe('Blocked 1 YouTube ad');
    expect(tabStats.badgeText(stats.count)).toBe('2');
  });
});
