const { playerResponse, nextResponse } = require('../fixtures/youtube/player-response.js');
const { install, EVENT_TYPE } = require('../../src/youtube/main-world.js');

class FakeResponse {
  constructor(body, url) { this.body = body; this.url = url; }
  async json() { return JSON.parse(this.body); }
  async text() { return this.body; }
}

function fakeWindow() {
  const posted = [];
  const win = {
    JSON: { parse: (text) => JSON.parse(text) },
    Response: FakeResponse,
    location: { origin: 'https://www.youtube.com' },
    postMessage: (data, origin) => posted.push({ data, origin }),
  };
  return { win, posted };
}

const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?key=k';

describe('MAIN-world install', () => {
  it('installs all four hooks', () => {
    expect(install(fakeWindow().win)).toBe(4);
  });

  it('strips parsed JSON and reports the count to the isolated world', () => {
    const { win, posted } = fakeWindow();
    install(win);
    const parsed = win.JSON.parse(JSON.stringify(playerResponse()));
    expect(parsed.adPlacements).toBeUndefined();
    expect(parsed.videoDetails.videoId).toBe('dQw4w9WgXcQ');
    expect(posted).toEqual([{ data: { source: EVENT_TYPE, removed: 4 }, origin: 'https://www.youtube.com' }]);
  });

  it('leaves unrelated JSON untouched and posts nothing', () => {
    const { win, posted } = fakeWindow();
    install(win);
    expect(win.JSON.parse('{"a":[1,2],"adSlots":[1]}')).toEqual({ a: [1, 2], adSlots: [1] });
    expect(posted).toHaveLength(0);
  });

  it('strips Response.json() and Response.text() for player/next urls only', async () => {
    const { win } = fakeWindow();
    install(win);
    const json = await new win.Response(JSON.stringify(playerResponse()), PLAYER_URL).json();
    expect(json.adSlots).toBeUndefined();
    const text = await new win.Response(JSON.stringify(nextResponse()), 'https://www.youtube.com/youtubei/v1/next').text();
    expect(JSON.parse(text).adSlots).toBeUndefined();
    expect(JSON.parse(text).contents).toBeDefined();
    const other = JSON.stringify(playerResponse());
    expect(await new win.Response(other, 'https://example.com/x').text()).toBe(other);
    expect(await new win.Response('not json', PLAYER_URL).text()).toBe('not json');
    const clean = JSON.stringify({ responseContext: {}, videoDetails: {} });
    expect(await new win.Response(clean, PLAYER_URL).text()).toBe(clean);
  });

  it('strips the inline ytInitialPlayerResponse through the setter trap', () => {
    const { win } = fakeWindow();
    win.ytInitialPlayerResponse = undefined;
    install(win);
    win.ytInitialPlayerResponse = playerResponse();
    expect(win.ytInitialPlayerResponse.playerAds).toBeUndefined();
    expect(win.ytInitialPlayerResponse.streamingData).toBeDefined();
    win.ytInitialPlayerResponse = 'later';
    expect(win.ytInitialPlayerResponse).toBe('later');
  });

  it('keeps the other hooks when one cannot be installed and survives postMessage failures', () => {
    const { win } = fakeWindow();
    win.Response = undefined;
    win.postMessage = () => { throw new Error('closed'); };
    expect(install(win)).toBe(2);
    expect(win.JSON.parse(JSON.stringify(playerResponse())).adSlots).toBeUndefined();
  });
});
