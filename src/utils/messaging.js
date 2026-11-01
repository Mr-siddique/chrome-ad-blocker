export const MSG = Object.freeze({
  PAGE_START: 'PAGE_START',
  AD_BLOCKED: 'AD_BLOCKED',
  GET_BLOCKING_STATE: 'GET_BLOCKING_STATE',
  GET_TAB_STATS: 'GET_TAB_STATS',
  GET_POPUP_STATE: 'GET_POPUP_STATE',
  SET_WHITELIST: 'SET_WHITELIST',
  SET_BLACKLIST: 'SET_BLACKLIST',
  SET_DISABLED: 'SET_DISABLED',
});

const isString = (value) => typeof value === 'string' && value.length > 0;
const isNumber = (value) => Number.isInteger(value);

function validItems(items) {
  return Array.isArray(items) && items.length <= 500 && items.every((item) => item && typeof item === 'object');
}

const VALIDATORS = {
  [MSG.PAGE_START]: (m) => typeof m.topFrame === 'boolean',
  [MSG.AD_BLOCKED]: (m) => isString(m.platform) && validItems(m.items),
  [MSG.GET_BLOCKING_STATE]: (m) => isString(m.hostname),
  [MSG.GET_TAB_STATS]: (m) => isNumber(m.tabId),
  [MSG.GET_POPUP_STATE]: (m) => isNumber(m.tabId) && typeof m.hostname === 'string',
  [MSG.SET_WHITELIST]: (m) => isString(m.domain) && typeof m.whitelisted === 'boolean',
  [MSG.SET_BLACKLIST]: (m) => isString(m.domain) && typeof m.blacklisted === 'boolean',
  [MSG.SET_DISABLED]: (m) => typeof m.disabled === 'boolean' && ['session', 'permanent'].includes(m.scope),
};

export function validateMessage(message) {
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    return { ok: false, error: 'Malformed message' };
  }
  const validator = VALIDATORS[message.type];
  if (!validator) return { ok: false, error: `Unknown message type: ${message.type}` };
  return validator(message) ? { ok: true } : { ok: false, error: `Invalid ${message.type} payload` };
}

// Never throws: the worker may be asleep, gone, or the extension context invalidated.
export async function sendMessage(message) {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return response || { ok: false, error: 'No response from background' };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error), unavailable: true };
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendWithRetry(message, retryDelayMs = 1000) {
  const first = await sendMessage(message);
  if (!first.unavailable) return first;
  await sleep(retryDelayMs);
  return sendMessage(message);
}
