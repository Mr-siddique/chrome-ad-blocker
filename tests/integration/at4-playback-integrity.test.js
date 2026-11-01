import { PLATFORMS } from '../../src/content/platform-detect.js';
import { observeAds, removeAdElements } from '../../src/content/player-ads.js';
import { createMockPlayer } from '../harness/mock-player.js';

// Synthetic harness: proves the removal logic leaves the modeled player intact. It does not
// replace AT-5 (real-site playback), which has NOT been run.
describe.each(['prime-video', 'jio-hotstar'])('AT-4 playback integrity (%s)', (platform) => {
  let player;
  let observer;

  beforeEach(() => {
    document.body.innerHTML = '';
    player = createMockPlayer(document, platform);
    observer = observeAds(document.body, PLATFORMS[platform], () => {});
  });

  afterEach(() => observer.disconnect());

  async function playThroughAd(kind) {
    player.advance(5000);
    const ad = player.injectAd(kind);
    await Promise.resolve();
    player.advance(5000);
    return ad;
  }

  it.each(['overlay', 'banner', 'breakIndicator', 'slot', 'container', 'iframe', 'video'])(
    'removes a %s ad without breaking playback',
    async (kind) => {
      const expectedBefore = 10;
      const ad = await playThroughAd(kind);
      expect(ad.isConnected).toBe(false);
      expect(player.video.isConnected).toBe(true);
      expect(player.state.longestBlankMs).toBeLessThanOrEqual(500);
      expect(player.state.longestBlankMs).toBe(0);
      expect(Math.abs(player.progressValue() - player.state.position)).toBeLessThanOrEqual(1);
      expect(Math.abs(player.state.position - expectedBefore)).toBeLessThanOrEqual(1);
      expect(player.subtitleText()).toBe('Line 2');
      expect(player.controlsPresent()).toBe(true);
    }
  );

  it('keeps play, pause, seek and volume controls responsive after removal', async () => {
    await playThroughAd('overlay');
    expect(player.state.playing).toBe(true);
    player.pressPlayPause();
    expect(player.state.playing).toBe(false);
    const paused = player.state.position;
    player.advance(3000);
    expect(player.state.position).toBe(paused);
    player.pressPlayPause();
    expect(player.state.playing).toBe(true);
    player.pressVolume();
    expect(player.state.volume).toBe(0);
    player.advance(2000);
    expect(player.state.position).toBeCloseTo(paused + 2, 5);
    expect(player.progressValue()).toBe(Math.floor(player.state.position));
  });

  it('renders updated subtitles after an ad is removed', async () => {
    await playThroughAd('iframe');
    player.advance(5000);
    expect(player.subtitleText()).toBe('Line 3');
  });

  it('does nothing harmful on an unknown ad structure', async () => {
    const unknown = await playThroughAd('unknown');
    expect(unknown.isConnected).toBe(true);
    expect(player.controlsPresent()).toBe(true);
    expect(player.state.longestBlankMs).toBe(0);
  });

  it('harness self-check: an over-eager remover that deletes controls is detected', () => {
    player.root.querySelector('.player-controls').remove();
    expect(player.controlsPresent()).toBe(false);
    player.video.remove();
    player.advance(1000);
    expect(player.state.longestBlankMs).toBeGreaterThan(500);
  });

  it('the real remover never deletes player parts even when run repeatedly', () => {
    for (let i = 0; i < 5; i += 1) removeAdElements(document.body, PLATFORMS[platform]);
    expect(player.controlsPresent()).toBe(true);
    expect(player.video.isConnected).toBe(true);
    expect(player.root.querySelector('.subtitles')).not.toBeNull();
  });
});
