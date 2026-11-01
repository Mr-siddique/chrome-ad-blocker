import { getTopHostname, pickContext } from '../../src/content/runner.js';
import { detectPlatform, getPlatformContext } from '../../src/content/platform-detect.js';

function loadContentScript() {
  let mod;
  jest.isolateModules(() => {
    mod = require('../../src/content/runner.js');
  });
  return mod;
}

describe('detectPlatform', () => {
  it.each([
    [{ hostname: 'www.primevideo.com', pathname: '/' }, 'prime-video'],
    [{ hostname: 'primevideo.com', pathname: '/detail/x' }, 'prime-video'],
    [{ hostname: 'www.amazon.com', pathname: '/gp/video/detail/B0' }, 'prime-video'],
    [{ hostname: 'www.amazon.co.uk', pathname: '/gp/video/storefront' }, 'prime-video'],
    [{ hostname: 'www.hotstar.com', pathname: '/in' }, 'jio-hotstar'],
    [{ hostname: 'www.jiohotstar.com', pathname: '/' }, 'jio-hotstar'],
    [{ hostname: 'www.amazon.com', pathname: '/dp/B0' }, null],
    [{ hostname: 'notprimevideo.com', pathname: '/' }, null],
    [{ hostname: 'primevideo.com.evil', pathname: '/' }, null],
    [{ hostname: 'example.com' }, null],
    [{}, null],
    [null, null],
  ])('%j -> %s', (location, expected) => {
    expect(detectPlatform(location)).toBe(expected);
  });

  it('returns a context for known platforms only', () => {
    expect(getPlatformContext('prime-video').filter.id).toBe('prime-video');
    expect(getPlatformContext('nope')).toBeNull();
    expect(getPlatformContext(null)).toBeNull();
  });
});

describe('content script start', () => {
  it('uses general banner rules on non-streaming pages', async () => {
    document.body.innerHTML = '<article>text</article><div class="ad-slot"></div>';
    const { start } = loadContentScript();
    const observer = await start({ location: { hostname: 'example.com', pathname: '/' } }, document);
    expect(observer).not.toBeNull();
    expect(document.querySelector('.ad-slot')).toBeNull();
    expect(document.querySelector('article')).not.toBeNull();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'AD_BLOCKED', platform: 'general' }),
    );
    observer.disconnect();
  });

  it('picks streaming context on streaming hosts and banner context elsewhere', () => {
    expect(pickContext({ location: { hostname: 'www.hotstar.com', pathname: '/' } }).platform).toBe('jio-hotstar');
    expect(pickContext({ location: { hostname: 'example.com', pathname: '/' } }).platform).toBe('general');
  });

  it('the entry script starts the runner', async () => {
    chrome.runtime.sendMessage = jest.fn(async () => ({ ok: true, enabled: true }));
    const observe = jest.spyOn(MutationObserver.prototype, 'observe').mockImplementation(() => {});
    jest.isolateModules(() => {
      require('../../src/content-script.js');
    });
    await flushPromises();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'PAGE_START', topFrame: true });
    expect(observe).toHaveBeenCalled();
    observe.mockRestore();
  });

  it('does nothing on a whitelisted page', async () => {
    chrome.runtime.sendMessage = jest.fn(async () => ({ ok: true, enabled: false }));
    document.body.innerHTML = '<div class="ad-slot"></div>';
    const { start } = loadContentScript();
    expect(await start({ location: { hostname: 'example.com', pathname: '/' } }, document)).toBeNull();
    expect(document.querySelector('.ad-slot')).not.toBeNull();
  });

  it('removes ads on a streaming page and reports them to the background', async () => {
    document.body.innerHTML = '<video src="blob:x"></video><div class="ad-overlay"></div>';
    const { start } = loadContentScript();
    const observer = await start({ location: { hostname: 'www.hotstar.com', pathname: '/' } }, document);
    expect(observer).not.toBeNull();
    expect(document.querySelector('.ad-overlay')).toBeNull();
    expect(document.querySelector('video')).not.toBeNull();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'AD_BLOCKED', platform: 'jio-hotstar' }),
    );
    observer.disconnect();
  });

  it('leaves YouTube to its dedicated scripts: no generic DOM removal', async () => {
    document.body.innerHTML = '<div class="html5-video-player ad-showing"><div class="ytp-ad-player-overlay"></div></div>';
    const { start } = loadContentScript();
    expect(await start({ location: { hostname: 'www.youtube.com', pathname: '/watch' } }, document)).toBeNull();
    expect(document.querySelector('.ytp-ad-player-overlay')).not.toBeNull();
  });

  it('keeps blocking when the extension context is invalidated', async () => {
    chrome.runtime.sendMessage = jest.fn(() => {
      throw new Error('Extension context invalidated');
    });
    document.body.innerHTML = '<div class="ad-overlay"></div>';
    const { start } = loadContentScript();
    const observer = await start({ location: { hostname: 'www.hotstar.com', pathname: '/' } }, document);
    expect(document.querySelector('.ad-overlay')).toBeNull();
    observer.disconnect();
  });

  it('tolerates a rejected sendMessage promise', async () => {
    chrome.runtime.sendMessage = jest.fn(() => Promise.reject(new Error('no receiver')));
    document.body.innerHTML = '<div class="ad-overlay"></div>';
    const { start } = loadContentScript();
    const observer = await start({ location: { hostname: 'www.hotstar.com', pathname: '/' } }, document);
    await flushPromises();
    expect(document.querySelector('.ad-overlay')).toBeNull();
    observer.disconnect();
  });
});

describe('getTopHostname', () => {
  it('uses the top ancestor origin inside frames', () => {
    const win = { location: { hostname: 'player.cdn.net', ancestorOrigins: ['https://x.com', 'https://www.primevideo.com'] } };
    expect(getTopHostname(win)).toBe('www.primevideo.com');
  });

  it('falls back to the own hostname', () => {
    expect(getTopHostname({ location: { hostname: 'a.com', ancestorOrigins: [] } })).toBe('a.com');
    expect(getTopHostname({ location: { hostname: 'a.com' } })).toBe('a.com');
    expect(getTopHostname({ location: { hostname: 'a.com', ancestorOrigins: ['not a url'] } })).toBe('a.com');
  });
});
