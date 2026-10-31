// Jest setup file - runs before all tests

// Mock Chrome API (not available in jsdom)
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn((message, callback) => {
      callback({ success: true });
    }),
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((data, callback) => callback()),
      remove: jest.fn((keys, callback) => callback()),
    },
    sync: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((data, callback) => callback()),
      remove: jest.fn((keys, callback) => callback()),
    },
  },
  tabs: {
    query: jest.fn((query, callback) => callback([])),
    sendMessage: jest.fn((tabId, message, callback) => callback({ success: true })),
  },
  scripting: {
    executeScript: jest.fn((details) => Promise.resolve([])),
  },
};

// Mock console to avoid test output noise
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

// Utility for async tests
global.flushPromises = () => new Promise(resolve => setImmediate(resolve));
