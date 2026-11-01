import { PRIME_VIDEO_FILTER, PRIME_VIDEO_RULE_SET } from '../../src/filters/prime-video.js';
import { shouldBlockUrl } from '../../src/utils/filters.js';
import { blockRate, loadDomFixtures, loadEndpoints, scanFixture } from '../harness/corpus.js';

// The corpus is author-generated and unconfirmed (see tests/fixtures/README.md), so a pass
// here is not evidence of the real-world rate.
describe('AT-1 Prime Video block rate', () => {
  const corpus = loadEndpoints('prime-video');
  const endpointResults = corpus.items.map((item) => ({
    item,
    blocked: shouldBlockUrl(item.url, PRIME_VIDEO_RULE_SET),
  }));
  const domResults = loadDomFixtures('prime-video').map((fixture) => ({
    item: fixture,
    ...scanFixture(fixture.html, PRIME_VIDEO_FILTER, PRIME_VIDEO_RULE_SET),
  }));
  const all = [...endpointResults, ...domResults];

  it('has the required corpus size', () => {
    expect(corpus.meta.confirmed).toBe(false);
    expect(endpointResults.length).toBeGreaterThanOrEqual(50);
    expect(domResults.length).toBeGreaterThanOrEqual(20);
  });

  it('includes stitched items in the denominator', () => {
    expect(corpus.items.some((item) => item.stitched)).toBe(true);
    expect(domResults.some((result) => result.item.name.includes('stitched'))).toBe(true);
  });

  it('blocks at least 90% of the combined corpus', () => {
    const endpoints = blockRate(endpointResults);
    const dom = blockRate(domResults);
    const total = blockRate(all);
    const misses = all.filter((r) => !r.blocked).map((r) => r.item.id || r.item.name);
    console.info(
      `AT-1 endpoints ${endpoints.blocked}/${endpoints.total}, dom ${dom.blocked}/${dom.total}, ` +
        `combined ${(total.rate * 100).toFixed(1)}%, missed: ${misses.join(', ')}`
    );
    expect(endpoints.rate).toBeGreaterThanOrEqual(0.9);
    expect(dom.rate).toBeGreaterThanOrEqual(0.9);
    expect(total.rate).toBeGreaterThanOrEqual(0.9);
  });

  it('only misses items that are stitched or on unlisted domains', () => {
    const unexpected = endpointResults.filter(
      (r) => !r.blocked && !r.item.stitched && r.item.confidence !== 'synthetic'
    );
    expect(unexpected).toEqual([]);
  });

  it('never flags the player, controls or subtitles in any fixture', () => {
    expect(domResults.reduce((sum, r) => sum + r.falsePositives, 0)).toBe(0);
  });
});
