import { MSG, sendMessage, sendWithRetry, validateMessage } from '../../src/utils/messaging.js';

describe('validateMessage', () => {
  it.each([
    [{ type: MSG.PAGE_START, topFrame: true }],
    [{ type: MSG.AD_BLOCKED, platform: 'prime-video', items: [{ domain: 'a.com' }] }],
    [{ type: MSG.GET_BLOCKING_STATE, hostname: 'a.com' }],
    [{ type: MSG.GET_TAB_STATS, tabId: 3 }],
    [{ type: MSG.GET_POPUP_STATE, tabId: 3, hostname: '' }],
    [{ type: MSG.SET_WHITELIST, domain: 'a.com', whitelisted: true }],
    [{ type: MSG.SET_BLACKLIST, domain: 'a.com', blacklisted: false }],
    [{ type: MSG.SET_DISABLED, disabled: true, scope: 'session' }],
  ])('accepts %j', (message) => {
    expect(validateMessage(message)).toEqual({ ok: true });
  });

  it.each([
    [null], [undefined], ['str'], [{}], [{ type: 5 }], [{ type: 'NOPE' }],
    [{ type: MSG.PAGE_START }],
    [{ type: MSG.AD_BLOCKED, platform: '', items: [] }],
    [{ type: MSG.AD_BLOCKED, platform: 'p', items: 'x' }],
    [{ type: MSG.AD_BLOCKED, platform: 'p', items: [null] }],
    [{ type: MSG.AD_BLOCKED, platform: 'p', items: new Array(501).fill({}) }],
    [{ type: MSG.GET_TAB_STATS, tabId: '3' }],
    [{ type: MSG.SET_DISABLED, disabled: true, scope: 'forever' }],
  ])('rejects %j', (message) => {
    const result = validateMessage(message);
    expect(result.ok).toBe(false);
    expect(result.error).toEqual(expect.any(String));
  });
});

describe('sendMessage', () => {
  it('returns the response', async () => {
    chrome.runtime.sendMessage = jest.fn(async () => ({ ok: true, value: 1 }));
    expect(await sendMessage({ type: MSG.PAGE_START, topFrame: true })).toEqual({ ok: true, value: 1 });
  });

  it('never throws and flags unavailability', async () => {
    chrome.runtime.sendMessage = jest.fn(async () => {
      throw new Error('Could not establish connection');
    });
    expect(await sendMessage({})).toMatchObject({ ok: false, unavailable: true });
    chrome.runtime.sendMessage = jest.fn(() => {
      throw 'sync failure';
    });
    expect((await sendMessage({})).error).toBe('sync failure');
  });

  it('reports an empty response as an error', async () => {
    chrome.runtime.sendMessage = jest.fn(async () => undefined);
    expect((await sendMessage({})).ok).toBe(false);
  });
});

describe('sendWithRetry', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('retries once after the delay when the worker is unavailable', async () => {
    chrome.runtime.sendMessage = jest
      .fn()
      .mockRejectedValueOnce(new Error('asleep'))
      .mockResolvedValueOnce({ ok: true });
    const promise = sendWithRetry({}, 1000);
    await Promise.resolve();
    await Promise.resolve();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(999);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(await promise).toEqual({ ok: true });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('does not retry after a successful response', async () => {
    chrome.runtime.sendMessage = jest.fn(async () => ({ ok: true }));
    expect(await sendWithRetry({})).toEqual({ ok: true });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('gives up after one retry', async () => {
    chrome.runtime.sendMessage = jest.fn(async () => {
      throw new Error('asleep');
    });
    const promise = sendWithRetry({}, 1000);
    await jest.advanceTimersByTimeAsync(1000);
    expect(await promise).toMatchObject({ ok: false, unavailable: true });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });
});
