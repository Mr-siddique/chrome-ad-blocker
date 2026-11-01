import { isYoutubeApiUrl, stripPlayerAds } from './strip.js';

export const EVENT_TYPE = 'sab-youtube-stripped';
export const CONFIG_TYPE = 'sab-youtube-config';

// Whitelisted or disabled pages: the isolated world (which can read storage) switches stripping off.
const config = { enabled: true };

export function listenForConfig(win) {
  if (typeof win.addEventListener !== 'function') return;
  win.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source === win && data && data.source === CONFIG_TYPE && data.enabled === false) config.enabled = false;
  });
}

const strip = (value) => (config.enabled ? stripPlayerAds(value) : 0);

function report(win, removed) {
  if (!removed) return;
  try {
    win.postMessage({ source: EVENT_TYPE, removed }, win.location.origin);
  } catch (error) {
    return;
  }
}

function wrapJsonParse(win) {
  const original = win.JSON.parse;
  win.JSON.parse = function parse(...args) {
    const result = original.apply(this, args);
    report(win, strip(result));
    return result;
  };
}

function wrapResponseJson(win, proto) {
  const original = proto.json;
  proto.json = async function json(...args) {
    const data = await original.apply(this, args);
    if (isYoutubeApiUrl(this.url)) report(win, strip(data));
    return data;
  };
}

function stripText(win, nativeParse, text) {
  try {
    const data = nativeParse.call(win.JSON, text);
    const removed = strip(data);
    if (!removed) return text;
    report(win, removed);
    return JSON.stringify(data);
  } catch (error) {
    return text;
  }
}

// nativeParse is the unwrapped parser, otherwise the JSON.parse hook would strip first and the
// rewritten text would never be produced.
function wrapResponseText(win, proto, nativeParse) {
  const original = proto.text;
  proto.text = async function text(...args) {
    const body = await original.apply(this, args);
    return isYoutubeApiUrl(this.url) ? stripText(win, nativeParse, body) : body;
  };
}

// The inline <script> assigns ytInitialPlayerResponse before any wrapped API runs.
function trapInitialResponse(win) {
  let stored = win.ytInitialPlayerResponse;
  Object.defineProperty(win, 'ytInitialPlayerResponse', {
    configurable: true,
    enumerable: true,
    get: () => stored,
    set: (value) => {
      report(win, strip(value));
      stored = value;
    },
  });
}

// Each step is independent: one failing hook must not disable the others or throw into the page.
export function install(win = window) {
  const nativeParse = win.JSON.parse;
  const steps = [
    () => wrapJsonParse(win),
    () => wrapResponseJson(win, win.Response.prototype),
    () => wrapResponseText(win, win.Response.prototype, nativeParse),
    () => trapInitialResponse(win),
    () => listenForConfig(win),
  ];
  return steps.filter((step) => {
    try {
      step();
      return true;
    } catch (error) {
      return false;
    }
  }).length;
}
