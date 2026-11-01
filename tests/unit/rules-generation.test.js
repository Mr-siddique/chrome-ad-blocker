import fs from 'fs';
import path from 'path';
import { GENERAL_FILTER } from '../../src/filters/general-ads.js';
import { JIO_HOTSTAR_FILTER } from '../../src/filters/jio-hotstar.js';
import { PRIME_VIDEO_FILTER } from '../../src/filters/prime-video.js';
import { VAST_VPAID_FILTER } from '../../src/filters/vast-vpaid.js';
import { BLOCKED_RESOURCE_TYPES, PRIORITY, TLD_EXPANSION, buildGeneralRules, buildStreamingRules, ruleToUrlFilters } from '../../src/utils/dnr-rules.js';
import { compileRules, evaluate, urlFilterToRegExp } from '../harness/dnr-sim.js';

const sources = { filters: [PRIME_VIDEO_FILTER, JIO_HOTSTAR_FILTER], vast: VAST_VPAID_FILTER };
const generated = buildStreamingRules(sources);

describe('ruleToUrlFilters', () => {
  it.each([
    [{ host: 'ads.jiohotstar.com' }, ['||ads.jiohotstar.com^']],
    [{ host: 'aiv-cdn.amazon.com', path: '/ads' }, ['||aiv-cdn.amazon.com/ads^']],
    [{ host: 'cdn-*.hotstar.com', path: '/ads' }, ['||cdn-*.hotstar.com/ads^']],
  ])('%j -> %j', (rule, expected) => {
    expect(ruleToUrlFilters(rule)).toEqual(expected);
  });

  it('expands a TLD wildcard into explicit, separator-terminated filters', () => {
    const filters = ruleToUrlFilters({ host: 'ad-tier-*.prd.primevideo.*' });
    expect(filters).toHaveLength(TLD_EXPANSION.length);
    expect(filters[0]).toBe('||ad-tier-*.prd.primevideo.com^');
    expect(filters.every((filter) => filter.endsWith('^'))).toBe(true);
  });
});

describe('generated streaming rules', () => {
  it('matches the committed src/rules/streaming-rules.json (run npm run build:rules)', () => {
    const file = path.resolve(__dirname, '../../src/rules/streaming-rules.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(generated);
  });

  it('matches the committed src/rules/general-rules.json (run npm run build:rules)', () => {
    const file = path.resolve(__dirname, '../../src/rules/general-rules.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(buildGeneralRules([GENERAL_FILTER]));
  });

  it('has unique sequential ids and stays within the static rule limit', () => {
    expect(generated.map((rule) => rule.id)).toEqual(generated.map((_, i) => i + 1));
    expect(generated.length).toBeGreaterThan(80);
    expect(generated.length).toBeLessThan(30000);
  });

  it('never blocks main_frame navigations', () => {
    expect(BLOCKED_RESOURCE_TYPES).not.toContain('main_frame');
    for (const rule of generated) expect(rule.condition.resourceTypes).not.toContain('main_frame');
  });

  it('deduplicates hosts shared by both platforms', () => {
    const filters = generated.map((rule) => `${rule.priority}|${rule.condition.urlFilter}`);
    expect(new Set(filters).size).toBe(filters.length);
  });

  it('uses valid DNR action types and priorities', () => {
    for (const rule of generated) {
      expect(['block', 'allow']).toContain(rule.action.type);
      expect(Object.values(PRIORITY)).toContain(rule.priority);
    }
  });
});

describe('dnr simulator and priority resolution', () => {
  const compiled = compileRules(generated);

  it('anchors || to domain boundaries', () => {
    const regex = urlFilterToRegExp('||ads.example.com^');
    expect(regex.test('https://ads.example.com/x')).toBe(true);
    expect(regex.test('https://eu.ads.example.com/x')).toBe(true);
    expect(regex.test('https://notads.example.com/x')).toBe(false);
    expect(regex.test('https://ads.example.com.evil/x')).toBe(false);
  });

  it('supports | anchors', () => {
    expect(urlFilterToRegExp('|https://a.com|').test('https://a.com')).toBe(true);
    expect(urlFilterToRegExp('|https://a.com|').test('https://a.com/x')).toBe(false);
    expect(urlFilterToRegExp('|https://a').test('xhttps://a')).toBe(false);
  });

  it('blocks ad hosts, allows subtitles, blocks ad-host manifests, spares content manifests', () => {
    expect(evaluate('https://ads.jiohotstar.com/x.js', compiled)).toBe('block');
    expect(evaluate('https://ads.jiohotstar.com/en.vtt', compiled)).toBe('allow');
    expect(evaluate('https://ads.jiohotstar.com/ad.m3u8', compiled)).toBe('block');
    expect(evaluate('https://example.com/a/vast.xml', compiled)).toBe('block');
    expect(evaluate('https://example.com/a/master.m3u8?vast=1', compiled)).toBe('allow');
    expect(evaluate('https://example.com/movie.mp4', compiled)).toBe('none');
    expect(evaluate('https://ad-tier-1.prd.primevideo.com.evil.io/x', compiled)).toBe('none');
    expect(evaluate('https://ad-tier-1.prd.primevideo.co.uk/x', compiled)).toBe('block');
    expect(evaluate('https://example.com/vastu-shastra', compiled)).toBe('none');
  });
});
