import fs from 'fs';
import path from 'path';
import { getBannerContext } from '../../src/content/banner-ads.js';
import { PLATFORMS } from '../../src/content/platform-detect.js';
import { findAdElements, removeAdElements } from '../../src/content/player-ads.js';
import { isVastVpaidRequest } from '../../src/filters/vast-vpaid.js';
import { shouldBlockUrl } from '../../src/utils/filters.js';
import { loadBundledFilters } from '../../src/utils/rules-loader.js';
import { FIXTURES } from '../harness/corpus.js';
import { compileRules, isBlockedByDnr } from '../harness/dnr-sim.js';

const CLEAN = path.join(FIXTURES, 'clean');
const rules = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/rules/streaming-rules.json'), 'utf8'));
const compiled = compileRules(rules);
const bundle = loadBundledFilters();

const corpus = JSON.parse(fs.readFileSync(path.join(CLEAN, 'domains.json'), 'utf8'));
const fixtures = fs.readdirSync(path.join(CLEAN, 'streaming-dom')).filter((f) => f.endsWith('.html')).sort()
  .map((name) => ({ name, html: fs.readFileSync(path.join(CLEAN, 'streaming-dom', name), 'utf8') }));

const PROTECTED = '.subtitles, .captions-window, .caption-line, .player-controls, .player-controls *, [role="slider"], [role="progressbar"], video';

function engines(url) {
  const hits = [];
  if (shouldBlockUrl(url, bundle.ruleSet)) hits.push('js-host');
  if (isVastVpaidRequest(url)) hits.push('js-vast');
  if (isBlockedByDnr(url, compiled)) hits.push('dnr');
  return hits;
}

describe('AT-8 false positives: clean domains and URLs', () => {
  const blocked = corpus.items.map((item) => ({ item, hits: engines(item.url) })).filter((r) => r.hits.length);

  it('has the required corpus size and honest metadata', () => {
    expect(corpus.items.length).toBeGreaterThanOrEqual(1000);
    expect(corpus.meta.confirmed).toBe(false);
  });

  it('blocks fewer than 2% of the clean corpus (and fewer than 20 of 1000)', () => {
    const rate = blocked.length / corpus.items.length;
    console.info(`AT-8 clean URLs: ${blocked.length}/${corpus.items.length} flagged (${(rate * 100).toFixed(2)}%): ` +
      blocked.map((r) => `${r.item.url} [${r.hits}]`).join('; '));
    expect(rate).toBeLessThan(0.02);
    expect(blocked.length).toBeLessThan(20);
  });

  it('flags only the documented heuristic-edge URLs', () => {
    const unexpected = blocked.filter((r) => r.item.category !== 'heuristic-edge');
    expect(unexpected).toEqual([]);
  });

  it('never blocks subtitles, streaming content or artwork', () => {
    const streaming = corpus.items.filter((i) => i.category.startsWith('streaming') || i.category.startsWith('adversarial'));
    expect(streaming.length).toBeGreaterThan(200);
    expect(streaming.filter((i) => engines(i.url).length)).toEqual([]);
  });

  it('does not match lookalike domains', () => {
    const lookalikes = corpus.items.filter((i) => i.category === 'lookalike');
    expect(lookalikes.length).toBeGreaterThan(30);
    expect(lookalikes.filter((i) => engines(i.url).length)).toEqual([]);
  });
});

describe('AT-8 false positives: clean streaming DOM fixtures', () => {
  it('has at least 50 fixtures covering both platforms', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(50);
    expect(fixtures.some((f) => f.name.startsWith('prime-video'))).toBe(true);
    expect(fixtures.some((f) => f.name.startsWith('jio-hotstar'))).toBe(true);
  });

  it.each(fixtures.map((f) => [f.name, f]))('%s is left completely unaltered', (name, fixture) => {
    const platform = name.startsWith('prime-video') ? 'prime-video' : 'jio-hotstar';
    document.body.innerHTML = new DOMParser().parseFromString(fixture.html, 'text/html').body.innerHTML;
    const before = document.body.innerHTML;
    const protectedBefore = document.querySelectorAll(PROTECTED).length;
    expect(findAdElements(document.body, PLATFORMS[platform])).toEqual([]);
    expect(removeAdElements(document.body, PLATFORMS[platform])).toEqual([]);
    expect(document.body.innerHTML).toBe(before);
    expect(document.querySelectorAll(PROTECTED).length).toBe(protectedBefore);
    expect(protectedBefore).toBeGreaterThan(0);
  });
});

describe('AT-8 re-run with general banner rules (T12 regression)', () => {
  it.each(fixtures.map((f) => [f.name, f]))('%s is untouched by banner rules', (name, fixture) => {
    document.body.innerHTML = new DOMParser().parseFromString(fixture.html, 'text/html').body.innerHTML;
    const before = document.body.innerHTML;
    expect(removeAdElements(document.body, getBannerContext())).toEqual([]);
    expect(document.body.innerHTML).toBe(before);
  });
});
