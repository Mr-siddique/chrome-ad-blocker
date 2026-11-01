import { PRIME_VIDEO_FILTER, PRIME_VIDEO_RULE_SET } from '../../src/filters/prime-video.js';
import { matchUrl, shouldBlockUrl } from '../../src/utils/filters.js';
import { validatePattern } from '../../src/utils/patterns.js';

describe('Prime Video filter list', () => {
  it('has at least 50 endpoint patterns with unique ids', () => {
    const ids = PRIME_VIDEO_FILTER.rules.map((rule) => rule.id);
    expect(ids.length).toBeGreaterThanOrEqual(50);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks every rule as unconfirmed with a confidence label', () => {
    for (const rule of PRIME_VIDEO_FILTER.rules) {
      expect(rule.confirmed).toBe(false);
      expect(['spec', 'vendor-known']).toContain(rule.confidence);
    }
  });

  it('uses only valid patterns', () => {
    for (const rule of PRIME_VIDEO_FILTER.rules) {
      expect(validatePattern(`${rule.host}${rule.path || ''}`).valid).toBe(true);
    }
  });

  it.each([
    ['https://aiv-cdn.amazon.com/ads/preroll/1.mp4'],
    ['https://ad-tier-3.prd.primevideo.com/v1/adbreak'],
    ['https://ad-tier-eu.prd.primevideo.co.uk/x'],
    ['https://aax-us-east.amazon-adsystem.com/e/dtb/bid'],
    ['https://securepubads.g.doubleclick.net/gampad/ads'],
  ])('blocks named ad endpoint %s', (url) => {
    expect(shouldBlockUrl(url, PRIME_VIDEO_RULE_SET)).toBe(true);
  });

  it.each([
    ['https://aiv-cdn.amazon.com/dm/content/title.mpd'],
    ['https://aiv-cdn.amazon.com/adserver-not-ads/x'],
    ['https://www.primevideo.com/detail/B000'],
    ['https://m.media-amazon.com/images/I/poster.jpg'],
    ['https://aiv-delivery.net/dm/seg_1.m4s'],
    ['https://ad-tier-3.prd.primevideo.com.evil/x'],
    ['https://www.amazon.com/gp/video/detail/B000'],
    ['https://aiv-cdn.amazon.com/ads/subs/en.vtt'],
  ])('does not block content or lookalike %s', (url) => {
    expect(shouldBlockUrl(url, PRIME_VIDEO_RULE_SET)).toBe(false);
  });

  it('returns the rule that matched', () => {
    expect(matchUrl('https://aiv-cdn.amazon.com/ads/x', PRIME_VIDEO_RULE_SET).confidence).toBe('spec');
  });
});
