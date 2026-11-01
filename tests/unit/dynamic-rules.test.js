import { ID_RANGES, buildDynamicRules, syncDynamicRules } from '../../src/utils/dynamic-rules.js';
import { addToBlacklist, addToWhitelist } from '../../src/utils/storage.js';

describe('buildDynamicRules', () => {
  it('builds allowAllRequests for whitelist and block for blacklist, in separate id ranges', () => {
    const rules = buildDynamicRules({ whitelist: ['a.com', 'b.com'], blacklist: ['c.com'] });
    expect(rules.map((r) => r.id)).toEqual([ID_RANGES.whitelist, ID_RANGES.whitelist + 1, ID_RANGES.blacklist]);
    expect(rules[0]).toMatchObject({ action: { type: 'allowAllRequests' }, condition: { urlFilter: '||a.com^' } });
    expect(rules[2]).toMatchObject({ action: { type: 'block' } });
    expect(rules[0].priority).toBeGreaterThan(rules[2].priority);
    expect(rules[2].condition.resourceTypes).not.toContain('main_frame');
  });

  it('defaults to no rules and caps each range', () => {
    expect(buildDynamicRules({})).toEqual([]);
    const many = Array.from({ length: 2000 }, (_, i) => `d${i}.com`);
    expect(buildDynamicRules({ whitelist: many })).toHaveLength(900);
  });
});

describe('syncDynamicRules', () => {
  it('replaces stale dynamic rules with ones built from storage', async () => {
    await addToWhitelist('a.com');
    await addToBlacklist('b.com');
    await syncDynamicRules();
    expect((await chrome.declarativeNetRequest.getDynamicRules()).map((r) => r.id)).toEqual([1, 1000]);
    await syncDynamicRules([{ id: 2000, priority: 1, action: { type: 'block' }, condition: { urlFilter: 'x' } }]);
    expect(await chrome.declarativeNetRequest.getDynamicRules()).toHaveLength(3);
  });
});
