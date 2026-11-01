import fs from 'fs';
import path from 'path';
import { GENERAL_FILTER, GENERAL_RULE_SET } from '../../src/filters/general-ads.js';
import { JIO_HOTSTAR_RULE_SET } from '../../src/filters/jio-hotstar.js';
import { PRIME_VIDEO_RULE_SET } from '../../src/filters/prime-video.js';
import { shouldBlockUrl } from '../../src/utils/filters.js';
import { FIXTURES, blockRate, loadEndpoints, scanFixture } from '../harness/corpus.js';
import { compileRules, isBlockedByDnr } from '../harness/dnr-sim.js';

const dir = path.join(FIXTURES, 'general');
const corpus = JSON.parse(fs.readFileSync(path.join(dir, 'domains.json'), 'utf8'));
const domFiles = fs.readdirSync(path.join(dir, 'dom')).filter((f) => f.endsWith('.html')).sort();
const readRules = (name) => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/rules', name), 'utf8'));

describe('AT-7 general banner block rate', () => {
  const domainResults = corpus.items.map((item) => ({ item, blocked: shouldBlockUrl(item.url, GENERAL_RULE_SET) }));
  const domResults = domFiles.map((name) => ({
    item: { name },
    ...scanFixture(fs.readFileSync(path.join(dir, 'dom', name), 'utf8'), GENERAL_FILTER, GENERAL_RULE_SET),
  }));

  it('has the required corpus size and honest metadata', () => {
    expect(corpus.meta.confirmed).toBe(false);
    expect(domainResults.length).toBeGreaterThanOrEqual(100);
    expect(domResults.length).toBeGreaterThanOrEqual(100);
  });

  it('blocks at least 95% of domains, of DOM fixtures and of the combined corpus', () => {
    const domains = blockRate(domainResults);
    const dom = blockRate(domResults);
    const all = blockRate([...domainResults, ...domResults]);
    const missed = [...domainResults, ...domResults].filter((r) => !r.blocked).map((r) => r.item.id || r.item.name);
    console.info(`AT-7 domains ${domains.blocked}/${domains.total}, dom ${dom.blocked}/${dom.total}, combined ${(all.rate * 100).toFixed(1)}%, missed: ${missed.join(', ')}`);
    expect(domains.rate).toBeGreaterThanOrEqual(0.95);
    expect(dom.rate).toBeGreaterThanOrEqual(0.95);
    expect(all.rate).toBeGreaterThanOrEqual(0.95);
  });

  it('flags no legitimate sibling element in any fixture', () => {
    expect(domResults.reduce((sum, r) => sum + r.falsePositives, 0)).toBe(0);
  });

  it('only misses unlisted domains and unknown-structure fixtures', () => {
    const unexpected = [...domainResults, ...domResults].filter(
      (r) => !r.blocked && r.item.confidence !== 'synthetic' && !(r.item.name || '').includes('unknown')
    );
    expect(unexpected).toEqual([]);
  });

  it('is covered by the generated general DNR ruleset', () => {
    const compiled = compileRules(readRules('general-rules.json'));
    const jsBlocked = corpus.items.filter((i) => shouldBlockUrl(i.url, GENERAL_RULE_SET));
    expect(jsBlocked.filter((i) => !isBlockedByDnr(i.url, compiled))).toEqual([]);
  });
});

describe('streaming precedence: general changes must not lower streaming rates', () => {
  const streamingOnly = compileRules(readRules('streaming-rules.json'));
  const both = compileRules([...readRules('streaming-rules.json'), ...readRules('general-rules.json').map((r) => ({ ...r, id: r.id + 100000 }))]);

  it.each([
    ['prime-video', PRIME_VIDEO_RULE_SET],
    ['jio-hotstar', JIO_HOTSTAR_RULE_SET],
  ])('%s request-level rate is identical with or without the general ruleset, and >= 90%% of non-stitched items', (platform, ruleSet) => {
    const urls = loadEndpoints(platform).items.map((i) => i.url);
    const rate = (compiled) => urls.filter((u) => isBlockedByDnr(u, compiled)).length / urls.length;
    expect(rate(both)).toBeGreaterThanOrEqual(rate(streamingOnly));
    expect(rate(streamingOnly)).toBeGreaterThanOrEqual(0.9);
    expect(urls.filter((u) => shouldBlockUrl(u, ruleSet)).length).toBeGreaterThan(0);
  });

  it('general host rules never block playback resources or subtitles', () => {
    const compiled = compileRules(readRules('general-rules.json'));
    const urls = ['https://ads.doubleclick.net/subs/en.vtt', 'https://cdn.taboola.com/stream/master.m3u8?vast=1'];
    expect(urls.map((u) => isBlockedByDnr(u, compiled))).toEqual([false, true]);
  });
});
