const { MSG } = require('../../src/utils/messaging.js');
const { EVENT_TYPE, CONFIG_TYPE } = require('../../src/youtube/main-world.js');
const yt = require('../../src/content/youtube-ads.js');

const PLAYER_HTML = (cls, extra = '') => `
  <div id="movie_player" class="html5-video-player ${cls}">
    <video class="video-stream html5-main-video"></video>
    <div class="ytp-chrome-bottom"><button class="ytp-play-button"></button><button class="ytp-subtitles-button"></button></div>
    <div class="ytp-caption-window-container"><span class="captions-text">hello</span></div>
    <div class="video-ads ytp-ad-module">${extra}</div>
  </div>`;
const SKIP = '<div class="ytp-ad-player-overlay"><button class="ytp-skip-ad-button">Skip</button></div>';
const UNSKIPPABLE = '<div class="ytp-ad-player-overlay"><span class="ytp-ad-text">Ad 1 of 2</span></div>';

function setVideo(video, { duration, currentTime = 0, muted = false, rate = 1 }) {
  Object.defineProperty(video, 'duration', { value: duration, configurable: true });
  video.currentTime = currentTime;
  video.muted = muted;
  video.playbackRate = rate;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  chrome.runtime.sendMessage = jest.fn().mockResolvedValue({ ok: true, enabled: true });
});

describe('createAdHandler', () => {
  it('touches nothing when no ad is showing (content, live, controls, captions)', () => {
    document.body.innerHTML = PLAYER_HTML('playing-mode', '<div class="ytp-ad-overlay-container"></div>');
    const player = document.querySelector('.html5-video-player');
    const video = player.querySelector('video');
    setVideo(video, { duration: Infinity, currentTime: 50, muted: false, rate: 1.5 });
    const before = player.outerHTML;
    const onBlocked = jest.fn();
    expect(yt.createAdHandler(player, onBlocked)()).toBe(false);
    expect(onBlocked).not.toHaveBeenCalled();
    expect([video.muted, video.playbackRate, video.currentTime]).toEqual([false, 1.5, 50]);
    expect(player.outerHTML).toBe(before);
  });

  it('clicks the skip button when present and leaves the video alone', () => {
    document.body.innerHTML = PLAYER_HTML('ad-showing', SKIP);
    const player = document.querySelector('.html5-video-player');
    const video = player.querySelector('video');
    setVideo(video, { duration: 30, currentTime: 2 });
    const clicked = jest.fn();
    player.querySelector('.ytp-skip-ad-button').addEventListener('click', clicked);
    const onBlocked = jest.fn();
    const tick = yt.createAdHandler(player, onBlocked);
    expect(tick()).toBe(true);
    tick();
    expect(clicked).toHaveBeenCalledTimes(2);
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(onBlocked).toHaveBeenCalledWith('skip');
    expect([video.muted, video.currentTime]).toEqual([false, 2]);
  });

  it.each(['ytp-skip-ad-button', 'ytp-ad-skip-button', 'ytp-ad-skip-button-modern'])('finds %s', (cls) => {
    document.body.innerHTML = PLAYER_HTML('ad-showing', `<div class="ytp-ad-player-overlay"><button class="${cls}"></button></div>`);
    const player = document.querySelector('.html5-video-player');
    const clicked = jest.fn();
    player.querySelector(`.${cls}`).addEventListener('click', clicked);
    yt.createAdHandler(player, jest.fn())();
    expect(clicked).toHaveBeenCalled();
  });

  it('mutes, seeks to the end and speeds up an unskippable ad, then restores', () => {
    document.body.innerHTML = PLAYER_HTML('ad-showing', UNSKIPPABLE);
    const player = document.querySelector('.html5-video-player');
    const video = player.querySelector('video');
    setVideo(video, { duration: 15, currentTime: 1, muted: false, rate: 1.25 });
    const onBlocked = jest.fn();
    const tick = yt.createAdHandler(player, onBlocked);
    tick();
    expect(video.muted).toBe(true);
    expect(video.playbackRate).toBe(16);
    expect(video.currentTime).toBe(15);
    expect(onBlocked).toHaveBeenCalledWith('fast-forward');
    player.classList.remove('ad-showing');
    player.querySelector('.ytp-ad-player-overlay').remove();
    expect(tick()).toBe(false);
    expect(video.muted).toBe(false);
    expect(video.playbackRate).toBe(1.25);
  });

  it('keeps a user-muted video muted after the ad and never seeks to non-finite durations', () => {
    document.body.innerHTML = PLAYER_HTML('ad-showing', UNSKIPPABLE);
    const player = document.querySelector('.html5-video-player');
    const video = player.querySelector('video');
    setVideo(video, { duration: NaN, currentTime: 0, muted: true });
    const tick = yt.createAdHandler(player, jest.fn());
    tick();
    expect(video.currentTime).toBe(0);
    setVideo(video, { duration: Infinity, currentTime: 0, muted: true });
    tick();
    expect(video.currentTime).toBe(0);
    player.classList.remove('ad-showing');
    player.querySelector('.ytp-ad-player-overlay').remove();
    tick();
    expect(video.muted).toBe(true);
  });

  it('does not touch controls or captions while fast-forwarding', () => {
    document.body.innerHTML = PLAYER_HTML('ad-showing', UNSKIPPABLE);
    const player = document.querySelector('.html5-video-player');
    setVideo(player.querySelector('video'), { duration: 10 });
    const controls = player.querySelector('.ytp-chrome-bottom').outerHTML;
    const captions = player.querySelector('.ytp-caption-window-container').outerHTML;
    yt.createAdHandler(player, jest.fn())();
    expect(player.querySelector('.ytp-chrome-bottom').outerHTML).toBe(controls);
    expect(player.querySelector('.ytp-caption-window-container').outerHTML).toBe(captions);
  });

  it('copes with an ad state that has no video element', () => {
    document.body.innerHTML = '<div class="html5-video-player ad-showing"></div>';
    expect(yt.createAdHandler(document.querySelector('.html5-video-player'), jest.fn())()).toBe(true);
  });
});

describe('hide style', () => {
  it('injects CSS only and never lists controls or captions', () => {
    const style = yt.injectHideStyle(document);
    expect(style.textContent).toMatch(/ytd-ad-slot-renderer/);
    expect(style.textContent).toMatch(/#masthead-ad/);
    expect(style.textContent).not.toMatch(/ytp-chrome|caption|subtitle|skip/);
    expect(document.head.contains(style)).toBe(true);
  });
});

describe('observePlayer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does nothing for a normal video, reacts when an ad class appears, retries, and stops', async () => {
    document.body.innerHTML = PLAYER_HTML('playing-mode');
    const player = document.querySelector('.html5-video-player');
    const video = player.querySelector('video');
    setVideo(video, { duration: NaN });
    const onBlocked = jest.fn();
    yt.observePlayer(window, document, onBlocked);
    expect(onBlocked).not.toHaveBeenCalled();
    player.classList.add('ad-showing');
    player.querySelector('.video-ads').innerHTML = UNSKIPPABLE;
    await Promise.resolve();
    expect(onBlocked).toHaveBeenCalledTimes(1);
    setVideo(video, { duration: 8, currentTime: 0 });
    jest.advanceTimersByTime(yt.RETRY_MS);
    expect(video.currentTime).toBe(8);
    player.classList.remove('ad-showing');
    player.querySelector('.video-ads').innerHTML = '';
    await Promise.resolve();
    expect(video.playbackRate).toBe(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('waits for the player to be added to the DOM', async () => {
    const onBlocked = jest.fn();
    yt.observePlayer(window, document, onBlocked);
    document.body.innerHTML = PLAYER_HTML('ad-showing', UNSKIPPABLE);
    await Promise.resolve();
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated DOM changes before the player exists', async () => {
    const onBlocked = jest.fn();
    yt.observePlayer(window, document, onBlocked);
    document.body.innerHTML = '<div>no player</div>';
    await Promise.resolve();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('never throws into the page when the handler fails', async () => {
    document.body.innerHTML = PLAYER_HTML('playing-mode');
    yt.observePlayer(window, document, () => { throw new Error('boom'); });
    const player = document.querySelector('.html5-video-player');
    expect(() => player.classList.add('ad-showing')).not.toThrow();
    await Promise.resolve();
  });
});

describe('startYoutubeAds', () => {
  const winFor = (hostname) => ({
    location: { hostname, origin: `https://${hostname}` },
    postMessage: jest.fn(),
    addEventListener: window.addEventListener.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
  });

  it('only runs on YouTube hosts', async () => {
    expect(yt.isYoutubeHost('www.youtube.com')).toBe(true);
    expect(yt.isYoutubeHost('notyoutube.com')).toBe(false);
    expect(yt.isYoutubeHost('youtube.com.evil.io')).toBe(false);
    expect(await yt.startYoutubeAds(winFor('example.com'), document)).toBeNull();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(document.getElementById('sab-youtube-hide')).toBeNull();
  });

  it('stays off and tells the MAIN world to stop when the site is disabled', async () => {
    chrome.runtime.sendMessage.mockResolvedValue({ ok: true, enabled: false });
    const win = winFor('www.youtube.com');
    expect(await yt.startYoutubeAds(win, document)).toBeNull();
    expect(win.postMessage).toHaveBeenCalledWith({ source: CONFIG_TYPE, enabled: false }, 'https://www.youtube.com');
    expect(document.getElementById('sab-youtube-hide')).toBeNull();
  });

  it('blocks by default when the background is unreachable, and reports platform youtube', async () => {
    chrome.runtime.sendMessage.mockRejectedValue(new Error('asleep'));
    document.body.innerHTML = PLAYER_HTML('ad-showing', UNSKIPPABLE);
    setVideo(document.querySelector('video'), { duration: 5 });
    await yt.startYoutubeAds(winFor('www.youtube.com'), document);
    expect(document.getElementById('sab-youtube-hide')).not.toBeNull();
  });

  it('counts a fast-forwarded ad and a stripped response as YouTube blocks', async () => {
    document.body.innerHTML = PLAYER_HTML('ad-showing', UNSKIPPABLE);
    setVideo(document.querySelector('video'), { duration: 5 });
    const win = winFor('www.youtube.com');
    await yt.startYoutubeAds(win, document);
    const calls = chrome.runtime.sendMessage.mock.calls.map((c) => c[0]).filter((m) => m.type === MSG.AD_BLOCKED);
    expect(calls).toEqual([{ type: MSG.AD_BLOCKED, platform: 'youtube', items: [{ reason: 'fast-forward', domain: 'youtube.com', tag: 'video' }] }]);
    window.dispatchEvent(new MessageEvent('message', { data: { source: EVENT_TYPE, removed: 3 }, source: win }));
    window.dispatchEvent(new MessageEvent('message', { data: { source: 'other', removed: 3 }, source: win }));
    window.dispatchEvent(new MessageEvent('message', { data: { source: EVENT_TYPE, removed: 'x' }, source: win }));
    window.dispatchEvent(new MessageEvent('message', { data: null, source: win }));
    const stripped = chrome.runtime.sendMessage.mock.calls.map((c) => c[0]).filter((m) => m.platform === 'youtube' && m.items[0].reason === 'response-strip');
    expect(stripped).toHaveLength(1);
  });
});
