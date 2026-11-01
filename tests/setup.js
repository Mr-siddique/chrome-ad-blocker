// Jest setup file - runs before all tests

function makeEvent() {
  const listeners = [];
  return {
    addListener: jest.fn((fn) => listeners.push(fn)),
    removeListener: jest.fn((fn) => {
      const index = listeners.indexOf(fn);
      if (index >= 0) listeners.splice(index, 1);
    }),
    hasListener: jest.fn((fn) => listeners.includes(fn)),
    emit: (...args) => listeners.map((fn) => fn(...args)),
  };
}

// Supports both callback and promise styles, like the real chrome.* MV3 APIs.
function respond(value, callback) {
  if (typeof callback === 'function') {
    callback(value);
    return undefined;
  }
  return Promise.resolve(value);
}

function pickKeys(data, keys) {
  if (keys == null) return { ...data };
  if (typeof keys === 'string') return keys in data ? { [keys]: data[keys] } : {};
  const list = Array.isArray(keys) ? keys : Object.keys(keys);
  const out = {};
  for (const key of list) {
    if (key in data) out[key] = data[key];
    else if (!Array.isArray(keys)) out[key] = keys[key];
  }
  return out;
}

const QUOTAS = {
  sync: { total: 102400, perItem: 8192, maxItems: 512 },
  local: { total: 10485760, perItem: Infinity, maxItems: Infinity },
};

function itemBytes(key, value) {
  return key.length + JSON.stringify(value).length;
}

// Mirrors chrome.storage quotas; the whole set() call is rejected atomically.
function assertQuota(name, data, items) {
  const limits = QUOTAS[name];
  const merged = { ...data };
  for (const [key, value] of Object.entries(items)) {
    if (itemBytes(key, value) > limits.perItem) throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
    merged[key] = value;
  }
  const keys = Object.keys(merged);
  if (keys.length > limits.maxItems) throw new Error('MAX_ITEMS quota exceeded');
  const total = keys.reduce((sum, key) => sum + itemBytes(key, merged[key]), 0);
  if (total > limits.total) throw new Error('QUOTA_BYTES quota exceeded');
}

function makeStorageArea(name, onChanged) {
  const data = {};
  const notify = (changes) => {
    if (Object.keys(changes).length) onChanged.emit(changes, name);
  };
  return {
    _data: data,
    get: jest.fn((keys, callback) => respond(pickKeys(data, keys), callback)),
    set: jest.fn((items, callback) => {
      try {
        assertQuota(name, data, items);
      } catch (error) {
        if (typeof callback === 'function') return callback();
        return Promise.reject(error);
      }
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: data[key], newValue: value };
        data[key] = JSON.parse(JSON.stringify(value));
      }
      notify(changes);
      return respond(undefined, callback);
    }),
    remove: jest.fn((keys, callback) => {
      const changes = {};
      for (const key of [].concat(keys)) {
        if (key in data) changes[key] = { oldValue: data[key] };
        delete data[key];
      }
      notify(changes);
      return respond(undefined, callback);
    }),
    clear: jest.fn((callback) => {
      Object.keys(data).forEach((key) => delete data[key]);
      return respond(undefined, callback);
    }),
    getBytesInUse: jest.fn((keys, callback) =>
      respond(JSON.stringify(pickKeys(data, keys)).length, callback)
    ),
  };
}

function makeDnr() {
  let dynamicRules = [];
  return {
    updateDynamicRules: jest.fn(async ({ removeRuleIds = [], addRules = [] }) => {
      dynamicRules = dynamicRules.filter((rule) => !removeRuleIds.includes(rule.id));
      dynamicRules.push(...addRules);
    }),
    getDynamicRules: jest.fn(async () => [...dynamicRules]),
    updateEnabledRulesets: jest.fn(async () => undefined),
    getAvailableStaticRuleCount: jest.fn(async () => 30000),
    MAX_NUMBER_OF_DYNAMIC_RULES: 5000,
  };
}

function makeChrome() {
  const storageChanged = makeEvent();
  return {
    runtime: {
      onMessage: makeEvent(),
      onInstalled: makeEvent(),
      onStartup: makeEvent(),
      sendMessage: jest.fn((message, callback) => respond({ success: true }, callback)),
      openOptionsPage: jest.fn(() => Promise.resolve()),
      getURL: jest.fn((path) => `chrome-extension://test/${path}`),
      lastError: undefined,
    },
    storage: {
      onChanged: storageChanged,
      local: makeStorageArea('local', storageChanged),
      sync: makeStorageArea('sync', storageChanged),
    },
    tabs: {
      query: jest.fn((query, callback) => respond([], callback)),
      get: jest.fn((tabId, callback) => respond({ id: tabId }, callback)),
      sendMessage: jest.fn((tabId, message, callback) => respond({ success: true }, callback)),
      onRemoved: makeEvent(),
      onUpdated: makeEvent(),
    },
    action: {
      setBadgeText: jest.fn(() => Promise.resolve()),
      setBadgeBackgroundColor: jest.fn(() => Promise.resolve()),
    },
    declarativeNetRequest: makeDnr(),
    webNavigation: {
      onCommitted: makeEvent(),
      onBeforeNavigate: makeEvent(),
    },
    scripting: {
      executeScript: jest.fn(() => Promise.resolve([])),
    },
  };
}

global.makeChromeMock = makeChrome;
global.chrome = makeChrome();

beforeEach(() => {
  global.chrome = makeChrome();
});

const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn((...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Not implemented') || args[0].includes('jsdom'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  });
  console.warn = jest.fn((...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning')) {
      return;
    }
    originalWarn.call(console, ...args);
  });
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

global.flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
