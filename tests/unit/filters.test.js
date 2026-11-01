import {
  buildRuleSet,
  isAllowlistedPlayerResource,
  isSubtitleUrl,
  matchElement,
  matchUrl,
  parseUrl,
  shouldBlockUrl,
} from '../../src/utils/filters.js';

const rules = [
  { id: 'a', host: 'ads.jiohotstar.com' },
  { id: 'b', host: 'aiv-cdn.amazon.com', path: '/ads' },
  { id: 'c', host: 'ad-tier-*.prd.primevideo.*' },
  { id: 'd', host: 'cdn-*.hotstar.com', path: '/ads' },
  { id: 'e', host: 'tracker.example.com', contains: ['vast', 'xml'], heuristic: true },
];
const ruleSet = buildRuleSet(rules, {
  classPatterns: [/^ad-/, /^advertisement/],
  sizes: [[300, 250]],
});

describe('parseUrl', () => {
  it.each([[''], [null], ['not a url'], ['ftp://x.com/a'], ['chrome://settings']])('rejects %p', (u) => {
    expect(parseUrl(u)).toBeNull();
  });

  it('parses host, path and search lower-cased host', () => {
    expect(parseUrl('https://ADS.Example.com/A?b=1')).toEqual({
      host: 'ads.example.com',
      path: '/A',
      search: '?b=1',
    });
  });
});

describe('matchUrl', () => {
  it('matches the host and its subdomains', () => {
    expect(matchUrl('https://ads.jiohotstar.com/x', ruleSet).id).toBe('a');
    expect(matchUrl('https://eu.ads.jiohotstar.com/x', ruleSet).id).toBe('a');
  });

  it('does not match lookalike domains', () => {
    expect(matchUrl('https://notads.jiohotstar.com.evil/x', ruleSet)).toBeNull();
    expect(matchUrl('https://xads.jiohotstar.com/x', ruleSet)).toBeNull();
    expect(matchUrl('https://jiohotstar.com/x', ruleSet)).toBeNull();
  });

  it('respects path prefixes on segment boundaries', () => {
    expect(matchUrl('https://aiv-cdn.amazon.com/ads/pre.mp4', ruleSet).id).toBe('b');
    expect(matchUrl('https://aiv-cdn.amazon.com/ads', ruleSet).id).toBe('b');
    expect(matchUrl('https://aiv-cdn.amazon.com/adserver', ruleSet)).toBeNull();
    expect(matchUrl('https://aiv-cdn.amazon.com/content/a.mp4', ruleSet)).toBeNull();
  });

  it('matches wildcard hosts', () => {
    expect(matchUrl('https://ad-tier-7.prd.primevideo.com/v', ruleSet).id).toBe('c');
    expect(matchUrl('https://cdn-3.hotstar.com/ads/x', ruleSet).id).toBe('d');
    expect(matchUrl('https://cdn-3.hotstar.com/video/x', ruleSet)).toBeNull();
  });

  it('supports contains conditions', () => {
    expect(matchUrl('https://tracker.example.com/a/VAST.xml', ruleSet).id).toBe('e');
    expect(matchUrl('https://tracker.example.com/a/vast', ruleSet)).toBeNull();
  });

  it('handles invalid input and missing rule sets', () => {
    expect(matchUrl('garbage', ruleSet)).toBeNull();
    expect(matchUrl('https://ads.jiohotstar.com/', null)).toBeNull();
  });
});

describe('subtitle and player resource guard', () => {
  it.each([
    ['https://ads.jiohotstar.com/en.vtt'],
    ['https://x.com/captions/en/1'],
    ['https://x.com/a/b.srt'],
  ])('treats %s as subtitle', (u) => expect(isSubtitleUrl(u)).toBe(true));

  it('flags manifests and segments as player resources', () => {
    expect(isAllowlistedPlayerResource('https://x.com/a.mpd')).toBe(true);
    expect(isAllowlistedPlayerResource('https://x.com/a/seg1.m4s')).toBe(true);
    expect(isAllowlistedPlayerResource('https://x.com/a.js')).toBe(false);
    expect(isAllowlistedPlayerResource('bad')).toBe(false);
    expect(isSubtitleUrl('bad')).toBe(false);
  });

  it('never blocks subtitles even on an ad host', () => {
    expect(shouldBlockUrl('https://ads.jiohotstar.com/en.vtt', ruleSet)).toBe(false);
  });

  it('lets explicit host rules block ad manifests but protects against heuristics', () => {
    expect(shouldBlockUrl('https://ads.jiohotstar.com/ad.m3u8', ruleSet)).toBe(true);
    expect(shouldBlockUrl('https://tracker.example.com/vast.xml', ruleSet)).toBe(true);
    const guarded = buildRuleSet([{ id: 'h', host: 'x.example.com', heuristic: true }]);
    expect(shouldBlockUrl('https://x.example.com/seg1.m4s', guarded)).toBe(false);
  });

  it('does not block unmatched urls', () => {
    expect(shouldBlockUrl('https://example.com/', ruleSet)).toBe(false);
  });
});

describe('matchElement', () => {
  it('matches by src and href', () => {
    expect(matchElement({ src: 'https://ads.jiohotstar.com/x.js' }, ruleSet).reason).toBe('url');
    expect(matchElement({ href: 'https://ads.jiohotstar.com/x' }, ruleSet).reason).toBe('url');
  });

  it('matches by class or id token', () => {
    expect(matchElement({ className: 'foo ad-slot' }, ruleSet).reason).toBe('class');
    expect(matchElement({ id: 'advertisement-1' }, ruleSet).reason).toBe('class');
  });

  it('matches by size only for iframe or ins', () => {
    expect(matchElement({ tag: 'iframe', width: 300, height: 250 }, ruleSet).reason).toBe('size');
    expect(matchElement({ tag: 'div', width: 300, height: 250 }, ruleSet)).toBeNull();
    expect(matchElement({ tag: 'iframe', width: 640, height: 360 }, ruleSet)).toBeNull();
  });

  it('does not flag content', () => {
    expect(matchElement({ className: 'article-content', id: 'main' }, ruleSet)).toBeNull();
    expect(matchElement({ className: 'ad' }, ruleSet)).toBeNull();
  });

  it('handles null inputs', () => {
    expect(matchElement(null, ruleSet)).toBeNull();
    expect(matchElement({}, null)).toBeNull();
    expect(matchElement({})).toBeNull();
  });
});

describe('performance', () => {
  it('matches a URL against a large rule set in well under 10ms', () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({ id: `r${i}`, host: `ad${i}.example${i % 50}.com` }));
    const big = buildRuleSet([...many, ...rules]);
    const start = performance.now();
    for (let i = 0; i < 100; i += 1) matchUrl('https://ads.jiohotstar.com/a', big);
    expect((performance.now() - start) / 100).toBeLessThan(1);
  });
});
