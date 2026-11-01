import { getBannerContext } from '../../src/content/banner-ads.js';
import { findAdElements, removeAdElements } from '../../src/content/player-ads.js';
import { GENERAL_FILTER, GENERAL_RULE_SET } from '../../src/filters/general-ads.js';
import { matchElement, shouldBlockUrl } from '../../src/utils/filters.js';
import { validatePattern } from '../../src/utils/patterns.js';

const context = getBannerContext();
const mount = (html) => {
  document.body.innerHTML = html;
  return document.body;
};

describe('general ad filter list', () => {
  it('has at least 100 unique, valid, unconfirmed ad hosts', () => {
    const hosts = GENERAL_FILTER.rules.map((rule) => rule.host);
    expect(hosts.length).toBeGreaterThanOrEqual(100);
    expect(new Set(hosts).size).toBe(hosts.length);
    for (const rule of GENERAL_FILTER.rules) {
      expect(validatePattern(rule.host).valid).toBe(true);
      expect(rule.confirmed).toBe(false);
      expect(rule.confidence).toBe('vendor-known');
    }
  });

  it('blocks ad hosts and spares lookalikes and normal sites', () => {
    expect(shouldBlockUrl('https://securepubads.g.doubleclick.net/x', GENERAL_RULE_SET)).toBe(true);
    expect(shouldBlockUrl('https://cdn.taboola.com/libtrc/x.js', GENERAL_RULE_SET)).toBe(true);
    expect(shouldBlockUrl('https://nottaboola.com/', GENERAL_RULE_SET)).toBe(false);
    expect(shouldBlockUrl('https://www.google.com/', GENERAL_RULE_SET)).toBe(false);
    expect(shouldBlockUrl('https://fonts.googleapis.com/css', GENERAL_RULE_SET)).toBe(false);
  });
});

describe('class and id patterns from the spec', () => {
  it.each([
    'ad-slot', 'ad-', 'advertisement', 'advertisement-block', 'advert-box', 'banner-ad',
    'banner-ad-top', 'top-banner-ad', 'adsbygoogle',
  ])('flags class %s', (cls) => {
    expect(matchElement({ className: `x ${cls}` }, GENERAL_RULE_SET)).toEqual({ reason: 'class' });
  });

  it.each([
    'ad-free-badge', 'add-to-cart', 'header-advanced', 'download-banner', 'shadow-box', 'adventure', 'bread-crumb', 'loading',
  ])('does not flag class %s', (cls) => {
    expect(matchElement({ className: cls }, GENERAL_RULE_SET)).toBeNull();
  });

  it('flags an id token', () => {
    expect(matchElement({ id: 'ad-banner-1' }, GENERAL_RULE_SET)).toEqual({ reason: 'class' });
  });
});

describe('size detection (layout stubbed)', () => {
  const stubLayout = (el, width, height) => {
    Object.defineProperty(el, 'offsetWidth', { value: width });
    Object.defineProperty(el, 'offsetHeight', { value: height });
  };

  it.each([[300, 250], [728, 90], [970, 90], [301, 249]])('removes a third-party %ix%i iframe', (w, h) => {
    const body = mount('<iframe src="https://partner.example.org/f"></iframe>');
    stubLayout(body.firstChild, w, h);
    expect(removeAdElements(body, context)).toHaveLength(1);
  });

  it.each([[640, 360], [300, 600], [320, 50]])('keeps a %ix%i iframe', (w, h) => {
    const body = mount('<iframe src="https://partner.example.org/f"></iframe>');
    stubLayout(body.firstChild, w, h);
    expect(removeAdElements(body, context)).toEqual([]);
  });

  it('only applies sizes to iframe and ins elements', () => {
    const body = mount('<div></div><img src="https://cdn.example.com/p.png">');
    for (const el of body.children) stubLayout(el, 300, 250);
    expect(findAdElements(body, context)).toEqual([]);
  });

  it('removes ins by size and class', () => {
    const body = mount('<ins class="adsbygoogle"></ins><ins></ins>');
    stubLayout(body.children[1], 728, 90);
    expect(removeAdElements(body, context)).toHaveLength(2);
  });
});

describe('protection on general pages', () => {
  it('never removes video, controls or subtitles even with ad-like classes', () => {
    const body = mount(
      '<div class="ad-container"><video src="blob:x"></video></div>' +
        '<div class="advertisement-controls"></div><div class="ad-subtitles"></div><p class="ad-free-badge">x</p>'
    );
    expect(removeAdElements(body, context)).toEqual([]);
  });
});
