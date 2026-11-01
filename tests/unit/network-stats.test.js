import { buildRuleIndex, classifyMatch, hostOf, refreshNetworkStats, resetBudget, withinBudget } from '../../src/utils/network-stats.js';
import * as tabStats from '../../src/utils/tab-stats.js';

const rule = (id, urlFilter, priority = 3, type = 'block') => ({ id, priority, action: { type }, condition: { urlFilter } });
const filters = [{ platform: 'prime-video', rules: [{ host: 'ads.primevideo.com' }] }];
const index = buildRuleIndex({
  streaming: [rule(1, '||ads.primevideo.com^'), rule(2, '/vast.xml', 1), rule(3, '.vtt^', 4, 'allow')],
  general: [rule(1, '||doubleclick.net^')],
}, filters);
const match = (rulesetId, ruleId, timeStamp) => ({ rule: { rulesetId, ruleId }, timeStamp });

beforeEach(() => {
  tabStats.clearAllTabs();
  resetBudget();
  chrome.declarativeNetRequest.getMatchedRules.mockReset();
});

describe('rule index', () => {
  it('extracts hosts and ignores non-host filters', () => {
    expect(hostOf('||a.b.com/x^')).toBe('a.b.com');
    expect(hostOf('/vast.xml')).toBeNull();
  });

  it('maps block rules to platform and domain, skipping allow rules', () => {
    expect(classifyMatch({ rulesetId: 'streaming', ruleId: 1 }, index)).toEqual({ platform: 'prime-video', domain: 'ads.primevideo.com' });
    expect(classifyMatch({ rulesetId: 'streaming', ruleId: 2 }, index)).toEqual({ platform: 'general', domain: 'VAST/VPAID request' });
    expect(classifyMatch({ rulesetId: 'general', ruleId: 1 }, index).platform).toBe('general');
    expect(classifyMatch({ rulesetId: 'streaming', ruleId: 3 }, index)).toBeNull();
  });

  it('counts dynamic blacklist and custom blocks but not whitelist or category allows', () => {
    expect(classifyMatch({ rulesetId: '_dynamic', ruleId: 1000 }, index).platform).toBe('general');
    expect(classifyMatch({ rulesetId: '_dynamic', ruleId: 2005 }, index)).not.toBeNull();
    expect(classifyMatch({ rulesetId: '_dynamic', ruleId: 1 }, index)).toBeNull();
    expect(classifyMatch({ rulesetId: '_dynamic', ruleId: 4000 }, index)).toBeNull();
  });
});

describe('refreshNetworkStats', () => {
  it('records new matches per platform and does not double count on the next poll', async () => {
    tabStats.resetTab(7);
    tabStats.setNetSince(7, 100);
    const rulesMatchedInfo = [match('streaming', 1, 150), match('streaming', 1, 160), match('general', 1, 170), match('streaming', 3, 175)];
    chrome.declarativeNetRequest.getMatchedRules.mockResolvedValue({ rulesMatchedInfo });
    expect(await refreshNetworkStats(7, index)).toBe(true);
    expect(chrome.declarativeNetRequest.getMatchedRules).toHaveBeenCalledWith({ tabId: 7, minTimeStamp: 100 });
    expect(tabStats.getTabStats(7)).toEqual({
      count: 3, byPlatform: { 'prime-video': 2, general: 1 },
      domains: [{ domain: 'ads.primevideo.com', count: 2 }, { domain: 'doubleclick.net', count: 1 }],
    });
    expect(tabStats.getNetSince(7)).toBe(175);
    expect(await refreshNetworkStats(7, index)).toBe(false);
    expect(tabStats.getTabStats(7).count).toBe(3);
  });

  it('returns false when the API throws (closed tab, quota, missing permission)', async () => {
    chrome.declarativeNetRequest.getMatchedRules.mockRejectedValue(new Error('quota'));
    expect(await refreshNetworkStats(7, index)).toBe(false);
  });

  it('tolerates a response without rulesMatchedInfo', async () => {
    chrome.declarativeNetRequest.getMatchedRules.mockResolvedValue({});
    expect(await refreshNetworkStats(7, index)).toBe(false);
  });

  it('skips background polls over budget but still serves forced (popup) polls', async () => {
    chrome.declarativeNetRequest.getMatchedRules.mockResolvedValue({ rulesMatchedInfo: [] });
    for (let i = 0; i < 18; i += 1) await refreshNetworkStats(7, index);
    chrome.declarativeNetRequest.getMatchedRules.mockClear();
    await refreshNetworkStats(7, index);
    expect(chrome.declarativeNetRequest.getMatchedRules).not.toHaveBeenCalled();
    await refreshNetworkStats(7, index, { force: true });
    expect(chrome.declarativeNetRequest.getMatchedRules).toHaveBeenCalledTimes(1);
  });

  it('the budget window slides', () => {
    for (let i = 0; i < 18; i += 1) expect(withinBudget(1000)).toBe(true);
    expect(withinBudget(1000)).toBe(false);
    expect(withinBudget(1000 + 10 * 60 * 1000 + 1)).toBe(true);
  });
});

describe('tab-stats net helpers', () => {
  it('defaults netSince to 0 for unknown tabs and creates the entry on set', () => {
    expect(tabStats.getNetSince(99)).toBe(0);
    tabStats.setNetSince(99, 5);
    expect(tabStats.getNetSince(99)).toBe(5);
  });
});
