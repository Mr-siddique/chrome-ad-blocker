const { playerResponse, nextResponse } = require('../fixtures/youtube/player-response.js');
const { stripPlayerAds, looksLikePlayerResponse, isYoutubeApiUrl, AD_KEYS } = require('../../src/youtube/strip.js');

describe('stripPlayerAds', () => {
  it('removes every ad field and leaves content fields deeply unchanged', () => {
    const response = playerResponse();
    const expected = playerResponse();
    AD_KEYS.forEach((key) => delete expected[key]);
    expect(stripPlayerAds(response)).toBe(4);
    expect(response).toEqual(expected);
    expect(response.captions).toBeDefined();
    expect(response.streamingData.adaptiveFormats).toHaveLength(1);
  });

  it('strips /next responses and {playerResponse} wrappers', () => {
    const next = nextResponse();
    expect(stripPlayerAds(next)).toBe(1);
    expect(next.adSlots).toBeUndefined();
    expect(next.contents).toBeDefined();
    const wrapped = { playerResponse: playerResponse(), page: 'watch' };
    expect(stripPlayerAds(wrapped)).toBe(4);
    expect(wrapped.playerResponse.adPlacements).toBeUndefined();
    expect(wrapped.page).toBe('watch');
  });

  it('leaves objects that are not player responses untouched', () => {
    const unrelated = [{ adPlacements: [1] }, { responseContext: {}, other: 1 }, { responseContext: 'x', adSlots: [] }, [], 'str', 5, null, undefined];
    for (const value of unrelated) {
      const copy = JSON.parse(JSON.stringify(value === undefined ? null : value));
      expect(stripPlayerAds(value)).toBe(0);
      if (value !== undefined) expect(JSON.parse(JSON.stringify(value))).toEqual(copy);
    }
  });

  it('never throws on hostile objects', () => {
    const hostile = new Proxy({}, { has() { throw new Error('boom'); }, getPrototypeOf() { throw new Error('boom'); } });
    expect(stripPlayerAds(hostile)).toBe(0);
    const frozen = Object.freeze({ ...playerResponse() });
    expect(stripPlayerAds(frozen)).toBe(0);
  });

  it('detects shape and API urls', () => {
    expect(looksLikePlayerResponse(playerResponse())).toBe(true);
    expect(looksLikePlayerResponse({ responseContext: {} })).toBe(false);
    expect(isYoutubeApiUrl('https://www.youtube.com/youtubei/v1/player?key=k')).toBe(true);
    expect(isYoutubeApiUrl('https://www.youtube.com/youtubei/v1/next')).toBe(true);
    expect(isYoutubeApiUrl('https://www.youtube.com/youtubei/v1/search')).toBe(false);
    expect(isYoutubeApiUrl(undefined)).toBe(false);
  });
});
