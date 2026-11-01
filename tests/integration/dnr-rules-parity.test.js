import fs from 'fs';
import path from 'path';
import { JIO_HOTSTAR_RULE_SET } from '../../src/filters/jio-hotstar.js';
import { PRIME_VIDEO_RULE_SET } from '../../src/filters/prime-video.js';
import { isVastVpaidRequest } from '../../src/filters/vast-vpaid.js';
import { shouldBlockUrl } from '../../src/utils/filters.js';
import { FIXTURES, loadEndpoints } from '../harness/corpus.js';
import { compileRules, isBlockedByDnr } from '../harness/dnr-sim.js';

const rules = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/rules/streaming-rules.json'), 'utf8'));
const compiled = compileRules(rules);

function vastUrls() {
  const base = path.join(FIXTURES, 'vast-vpaid');
  const urls = [];
  for (const platform of fs.readdirSync(base)) {
    for (const type of fs.readdirSync(path.join(base, platform))) {
      const dir = path.join(base, platform, type);
      for (const file of fs.readdirSync(dir)) urls.push(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).url);
    }
  }
  return urls;
}

describe('DNR rule parity with the JS matcher', () => {
  const cases = [
    ['prime-video', PRIME_VIDEO_RULE_SET],
    ['jio-hotstar', JIO_HOTSTAR_RULE_SET],
  ];

  it.each(cases)('%s: every URL blocked by JS is blocked by a generated DNR rule', (platform, ruleSet) => {
    const urls = loadEndpoints(platform).items.map((item) => item.url);
    const jsBlocked = urls.filter((url) => shouldBlockUrl(url, ruleSet));
    const missing = jsBlocked.filter((url) => !isBlockedByDnr(url, compiled));
    const domOnly = urls.length - jsBlocked.length;
    console.info(`DNR parity ${platform}: ${jsBlocked.length - missing.length}/${jsBlocked.length} JS-blocked covered; ${domOnly} not blockable by URL (DOM-only/unblockable)`);
    expect(missing).toEqual([]);
  });

  it('every blocked VAST/VPAID wrapper fixture is covered by a DNR rule', () => {
    const urls = vastUrls();
    const jsBlocked = urls.filter((url) => isVastVpaidRequest(url));
    expect(jsBlocked.length).toBeGreaterThan(0);
    expect(jsBlocked.filter((url) => !isBlockedByDnr(url, compiled))).toEqual([]);
  });

  it('DNR does not block content URLs that the JS matcher spares', () => {
    const content = [
      'https://aiv-cdn.amazon.com/dm/content/title.mpd',
      'https://www.primevideo.com/detail/B000',
      'https://cdn-2.hotstar.com/video/vod/title/master.m3u8',
      'https://img1.hotstar.com/image/upload/poster.jpg',
      'https://aiv-cdn.amazon.com/ads/subs/en.vtt',
    ];
    for (const url of content) expect(isBlockedByDnr(url, compiled)).toBe(false);
  });
});
