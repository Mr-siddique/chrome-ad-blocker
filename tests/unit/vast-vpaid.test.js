import {
  VAST_VPAID_FILTER,
  classifyAdProtocolRequest,
  isVastVpaidRequest,
} from '../../src/filters/vast-vpaid.js';

describe('classifyAdProtocolRequest', () => {
  it.each([
    ['https://x.com/vast.xml', 'vast'],
    ['https://x.com/ads/vast/v4/a', 'vast'],
    ['https://x.com/vast3/ad', 'vast'],
    ['https://x.com/a/vast_wrapper/1', 'vast'],
    ['https://x.com/vmap/1', 'vast'],
    ['https://x.com/gampad/ads?output=vast', 'vast'],
    ['https://x.com/gampad/ads?iu=1&output=xml_vast4', 'vast'],
    ['https://x.com/gampad/ads?output=vmap', 'vast'],
    ['https://x.com/a?vast=1', 'vast'],
    ['https://x.com/a?vastversion=4', 'vast'],
    ['https://x.com/a?ad_type=vast', 'vast'],
    ['https://x.com/a?adtype=VAST', 'vast'],
    ['https://x.com/creative/vpaid.js', 'vpaid'],
    ['https://x.com/a?apiFramework=VPAID', 'vpaid'],
  ])('classifies %s as %s', (url, type) => {
    expect(classifyAdProtocolRequest(url)).toBe(type);
  });

  it.each([
    ['https://x.com/vastness/page'],
    ['https://x.com/broadcast/live'],
    ['https://x.com/movies/title?id=1'],
    ['https://x.com/a/master.m3u8?vast=1'],
    ['https://x.com/a/manifest.mpd'],
    ['https://x.com/subtitles/vast.vtt'],
    ['https://x.com/a/seg_1.m4s?vpaid=1'],
    ['not a url'],
    [''],
    [null],
  ])('ignores %p', (url) => {
    expect(classifyAdProtocolRequest(url)).toBeNull();
    expect(isVastVpaidRequest(url)).toBe(false);
  });

  it('isVastVpaidRequest is true for wrappers', () => {
    expect(isVastVpaidRequest('https://x.com/vast.xml')).toBe(true);
  });
});

describe('VAST_VPAID_FILTER', () => {
  it('exposes DNR url filters with unique ids', () => {
    const ids = VAST_VPAID_FILTER.signatures.map((signature) => signature.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const signature of VAST_VPAID_FILTER.signatures) {
      expect(signature.urlFilter.length).toBeGreaterThan(3);
      expect(['vast', 'vpaid']).toContain(signature.type);
    }
  });
});
