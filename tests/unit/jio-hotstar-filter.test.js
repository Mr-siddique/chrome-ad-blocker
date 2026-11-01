import { JIO_HOTSTAR_FILTER, JIO_HOTSTAR_RULE_SET } from '../../src/filters/jio-hotstar.js';
import { matchUrl, shouldBlockUrl } from '../../src/utils/filters.js';
import { validatePattern } from '../../src/utils/patterns.js';

describe('Jio Hotstar filter list', () => {
  it('has at least 30 endpoint patterns with unique ids', () => {
    const ids = JIO_HOTSTAR_FILTER.rules.map((rule) => rule.id);
    expect(ids.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks every rule as unconfirmed with a confidence label', () => {
    for (const rule of JIO_HOTSTAR_FILTER.rules) {
      expect(rule.confirmed).toBe(false);
      expect(['spec', 'vendor-known']).toContain(rule.confidence);
    }
  });

  it('uses only valid patterns', () => {
    for (const rule of JIO_HOTSTAR_FILTER.rules) {
      expect(validatePattern(`${rule.host}${rule.path || ''}`).valid).toBe(true);
    }
  });

  it.each([
    ['https://ads.jiohotstar.com/v1/serve'],
    ['https://cdn-2.hotstar.com/ads/preroll/1.mp4'],
    ['https://pubads.g.doubleclick.net/gampad/ads'],
    ['https://inmobi.com/sdk'],
  ])('blocks named ad endpoint %s', (url) => {
    expect(shouldBlockUrl(url, JIO_HOTSTAR_RULE_SET)).toBe(true);
  });

  it.each([
    ['https://cdn-2.hotstar.com/video/vod/title/master.m3u8'],
    ['https://cdn-2.hotstar.com/adserver/x'],
    ['https://www.hotstar.com/in/movies/x'],
    ['https://www.jiohotstar.com/'],
    ['https://ads.jiohotstar.com.evil/x'],
    ['https://cdn-2.hotstar.com/ads/subs/en.vtt'],
    ['https://img1.hotstar.com/image/upload/poster.jpg'],
  ])('does not block content or lookalike %s', (url) => {
    expect(shouldBlockUrl(url, JIO_HOTSTAR_RULE_SET)).toBe(false);
  });

  it('returns the matching rule', () => {
    expect(matchUrl('https://ads.jiohotstar.com/x', JIO_HOTSTAR_RULE_SET).confidence).toBe('spec');
  });
});
