import { PLATFORMS } from '../../src/content/platform-detect.js';
import { observeAds } from '../../src/content/player-ads.js';
import { createMockPlayer } from '../harness/mock-player.js';

// Deterministic PRNG so the run is reproducible.
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

// 14 blockable kinds to 1 unknown structure, mirroring the corpus' unblockable share.
const KIND_MIX = [
  'overlay', 'banner', 'breakIndicator', 'slot', 'container', 'iframe', 'video',
  'overlay', 'banner', 'breakIndicator', 'slot', 'container', 'iframe', 'video', 'unknown',
];

const p95 = (values) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];

describe.each(['prime-video', 'jio-hotstar'])('AT-6 dynamic injection and AT-11 latency (%s)', (platform) => {
  const results = [];
  const latencies = [];

  beforeAll(async () => {
    jest.useFakeTimers({ doNotFake: ['hrtime', 'performance'] });
    document.body.innerHTML = '';
    const player = createMockPlayer(document, platform);
    const injectedAt = { last: 0n };
    const random = seeded(platform.length * 7919);
    const staticAds = KIND_MIX.slice(0, 5).map((kind) => player.injectAd(kind));
    const observer = observeAds(document.body, PLATFORMS[platform], (removed) => {
      const now = process.hrtime.bigint();
      if (injectedAt.last) removed.forEach(() => latencies.push(Number(now - injectedAt.last) / 1e6));
    });
    staticAds.forEach((el, i) => results.push({ phase: 'static', kind: KIND_MIX[i], removed: !el.isConnected }));

    const total = 120;
    for (let i = 0; i < total; i += 1) {
      const kind = KIND_MIX[Math.floor(random() * KIND_MIX.length)];
      setTimeout(() => {
        injectedAt.last = process.hrtime.bigint();
        const el = player.injectAd(kind);
        Promise.resolve().then(() => results.push({ phase: 'dynamic', kind, removed: !el.isConnected }));
      }, Math.floor(random() * 60000));
    }
    while (jest.getTimerCount() > 0) {
      jest.advanceTimersToNextTimer();
      await Promise.resolve();
      await Promise.resolve();
    }
    observer.disconnect();
    jest.useRealTimers();
  });

  it('injects ads up to 60 s after load', () => {
    expect(results.filter((r) => r.phase === 'dynamic')).toHaveLength(120);
    expect(results.filter((r) => r.phase === 'static')).toHaveLength(5);
  });

  it('removes static and dynamic ads at >= 90%', () => {
    const rate = (phase) => {
      const subset = results.filter((r) => r.phase === phase);
      return subset.filter((r) => r.removed).length / subset.length;
    };
    console.info(`AT-6 ${platform}: static ${rate('static')}, dynamic ${rate('dynamic').toFixed(3)}`);
    expect(rate('static')).toBeGreaterThanOrEqual(0.9);
    expect(rate('dynamic')).toBeGreaterThanOrEqual(0.9);
  });

  it('only leaves ads of unknown structure behind', () => {
    const left = results.filter((r) => !r.removed);
    expect(left.every((r) => r.kind === 'unknown')).toBe(true);
  });

  it('detects within 100 ms at p95 over >= 100 injections (mocked harness)', () => {
    expect(latencies.length).toBeGreaterThanOrEqual(100);
    const value = p95(latencies);
    console.info(`AT-11 ${platform}: p95 ${value.toFixed(3)} ms over ${latencies.length}`);
    expect(value).toBeLessThan(100);
  });
});
