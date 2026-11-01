import { PLATFORMS } from '../../src/content/platform-detect.js';
import {
  classify,
  describeElement,
  findAdElements,
  isProtected,
  observeAds,
  removeAdElements,
} from '../../src/content/player-ads.js';

const context = PLATFORMS['prime-video'];

function mount(html) {
  document.body.innerHTML = html;
  return document.body;
}

describe('classify and describeElement', () => {
  it('describes an element', () => {
    const body = mount('<iframe class="a b" id="x" src="https://e.com/" width="300" height="250"></iframe>');
    expect(describeElement(body.firstChild)).toMatchObject({
      tag: 'iframe', id: 'x', className: 'a b', src: 'https://e.com/', width: 300, height: 250,
    });
  });

  it('classifies by selector, url and class', () => {
    const body = mount(
      '<div data-ad-type="x"></div><img src="https://securepubads.g.doubleclick.net/p.gif">' +
        '<div class="ad-overlay"></div><div class="content"></div>'
    );
    const [sel, img, cls, plain] = body.children;
    expect(classify(sel, context).reason).toBe('selector');
    expect(classify(img, context).reason).toBe('url');
    expect(classify(cls, context).reason).toBe('class');
    expect(classify(plain, context)).toBeNull();
  });
});

describe('isProtected', () => {
  it('protects html, body, content video, controls, sliders and subtitles', () => {
    const body = mount(
      '<video src="blob:x"></video><button>x</button><div role="slider"></div>' +
        '<div class="subtitles"></div><div aria-live="polite"></div><div class="player-controls"></div>'
    );
    expect(isProtected(document.documentElement, context)).toBe(true);
    expect(isProtected(body, context)).toBe(true);
    for (const el of body.children) expect(isProtected(el, context)).toBe(true);
  });

  it('does not protect an ad video or a plain ad container', () => {
    const body = mount(
      '<video src="https://aiv-cdn.amazon.com/ads/a.mp4"></video><div class="ad-overlay"><a href="#">x</a></div>'
    );
    expect(isProtected(body.children[0], context)).toBe(false);
    expect(isProtected(body.children[1], context)).toBe(false);
  });

  it('protects an ad-looking container that wraps the content video or subtitles', () => {
    const body = mount('<div class="ad-container"><video src="blob:x"></video></div>' +
      '<div class="ad-container"><div class="subtitles"></div></div>');
    expect(isProtected(body.children[0], context)).toBe(true);
    expect(isProtected(body.children[1], context)).toBe(true);
  });
});

describe('findAdElements and removeAdElements', () => {
  it('removes ads and reports reason, domain and tag', () => {
    const body = mount(
      '<video class="content" src="blob:x"></video><div class="subtitles">hi</div>' +
        '<iframe src="https://securepubads.g.doubleclick.net/a"></iframe><div class="ad-overlay"></div>'
    );
    const removed = removeAdElements(body, context);
    expect(removed).toEqual([
      { reason: 'url', domain: 'securepubads.g.doubleclick.net', tag: 'iframe' },
      { reason: 'class', domain: null, tag: 'div' },
    ]);
    expect(body.querySelector('video.content')).not.toBeNull();
    expect(body.querySelector('.subtitles')).not.toBeNull();
  });

  it('handles the root itself being the ad and skips disconnected nodes', () => {
    const body = mount('<div class="ad-overlay"></div>');
    const ad = body.firstChild;
    expect(findAdElements(ad, context)).toHaveLength(1);
    ad.remove();
    expect(findAdElements(ad, context)).toEqual([]);
  });

  it('uses the platform rule host as the domain for class matches by rule', () => {
    const body = mount('<script src="https://ad-tier-2.prd.primevideo.com/x.js"></script>');
    expect(removeAdElements(body, context)[0].domain).toBe('ad-tier-2.prd.primevideo.com');
  });

  it('leaves unknown DOM untouched and never throws', () => {
    const body = mount('<div class="x7f2 promo-slot">Sponsored</div><section><p>text</p></section>');
    expect(removeAdElements(body, context)).toEqual([]);
    expect(body.children).toHaveLength(2);
  });

  it('removes only the outer ad when nested ads match', () => {
    const body = mount('<div class="ad-container"><div class="ad-banner"></div></div>');
    expect(removeAdElements(body, context)).toHaveLength(1);
  });
});

describe('observeAds', () => {
  it('removes initial and later-added ads and calls back', async () => {
    const body = mount('<div class="ad-overlay"></div>');
    const onRemoved = jest.fn();
    const observer = observeAds(body, context, onRemoved);
    expect(onRemoved).toHaveBeenCalledTimes(1);
    body.insertAdjacentHTML('beforeend', '<div class="ad-banner"></div>');
    await Promise.resolve();
    expect(onRemoved).toHaveBeenCalledTimes(2);
    expect(body.children).toHaveLength(0);
    observer.disconnect();
  });

  it('catches an element whose src is switched to an ad url', async () => {
    const body = mount('<iframe src="about:blank"></iframe>');
    const onRemoved = jest.fn();
    const observer = observeAds(body, context, onRemoved);
    body.firstChild.setAttribute('src', 'https://securepubads.g.doubleclick.net/a');
    await Promise.resolve();
    expect(onRemoved).toHaveBeenCalledWith([expect.objectContaining({ tag: 'iframe' })]);
    observer.disconnect();
  });

  it('ignores text nodes and non-ad additions', async () => {
    const body = mount('');
    const onRemoved = jest.fn();
    const observer = observeAds(body, context, onRemoved);
    body.append('text', document.createElement('p'));
    await Promise.resolve();
    expect(onRemoved).not.toHaveBeenCalled();
    observer.disconnect();
  });
});
