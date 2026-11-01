import { detectPlatform, getPlatformContext } from '../../src/content/platform-detect.js';

function loadContentScript() {
  let mod;
  jest.isolateModules(() => {
    mod = require('../../src/content-script.js');
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
  it('does nothing on unsupported pages', () => {
    const { start } = loadContentScript();
    expect(start({ location: { hostname: 'example.com', pathname: '/' } }, document)).toBeNull();
  });

  it('removes ads on a streaming page and reports them to the background', async () => {
    document.body.innerHTML = '<video src="blob:x"></video><div class="ad-overlay"></div>';
    const { start } = loadContentScript();
    const observer = start({ location: { hostname: 'www.hotstar.com', pathname: '/' } }, document);
    expect(observer).not.toBeNull();
    expect(document.querySelector('.ad-overlay')).toBeNull();
    expect(document.querySelector('video')).not.toBeNull();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'AD_BLOCKED', platform: 'jio-hotstar' }),
    );
    observer.disconnect();
  });

  it('keeps blocking when the extension context is invalidated', () => {
    chrome.runtime.sendMessage = jest.fn(() => {
      throw new Error('Extension context invalidated');
    });
    document.body.innerHTML = '<div class="ad-overlay"></div>';
    const { start } = loadContentScript();
    const observer = start({ location: { hostname: 'www.hotstar.com', pathname: '/' } }, document);
    expect(document.querySelector('.ad-overlay')).toBeNull();
    observer.disconnect();
  });

  it('tolerates a rejected sendMessage promise', async () => {
    chrome.runtime.sendMessage = jest.fn(() => Promise.reject(new Error('no receiver')));
    document.body.innerHTML = '<div class="ad-overlay"></div>';
    const { start } = loadContentScript();
    const observer = start({ location: { hostname: 'www.hotstar.com', pathname: '/' } }, document);
    await flushPromises();
    expect(document.querySelector('.ad-overlay')).toBeNull();
    observer.disconnect();
  });
});
