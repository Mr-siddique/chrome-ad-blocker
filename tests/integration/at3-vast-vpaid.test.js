import fs from 'fs';
import path from 'path';
import { JIO_HOTSTAR_RULE_SET } from '../../src/filters/jio-hotstar.js';
import { PRIME_VIDEO_RULE_SET } from '../../src/filters/prime-video.js';
import { isVastVpaidRequest } from '../../src/filters/vast-vpaid.js';
import { shouldBlockUrl } from '../../src/utils/filters.js';
import { FIXTURES, blockRate } from '../harness/corpus.js';

const RULE_SETS = { 'prime-video': PRIME_VIDEO_RULE_SET, 'jio-hotstar': JIO_HOTSTAR_RULE_SET };

function loadGroup(platform, type) {
  const dir = path.join(FIXTURES, 'vast-vpaid', platform, type);
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

describe('AT-3 VAST/VPAID blocking', () => {
  describe.each([
    ['prime-video', 'vast'],
    ['prime-video', 'vpaid'],
    ['jio-hotstar', 'vast'],
    ['jio-hotstar', 'vpaid'],
  ])('%s %s', (platform, type) => {
    const items = loadGroup(platform, type);
    const results = items.map((item) => ({
      item,
      blocked: isVastVpaidRequest(item.url) || shouldBlockUrl(item.url, RULE_SETS[platform]),
    }));

    it('has at least 10 fixtures', () => {
      expect(items.length).toBeGreaterThanOrEqual(10);
      expect(items.every((item) => item.confirmed === false)).toBe(true);
    });

    it('blocks at least 90% of wrapper requests', () => {
      const { blocked, total, rate } = blockRate(results);
      console.info(`AT-3 ${platform} ${type}: ${blocked}/${total} (${(rate * 100).toFixed(1)}%)`);
      expect(rate).toBeGreaterThanOrEqual(0.9);
    });
  });
});
