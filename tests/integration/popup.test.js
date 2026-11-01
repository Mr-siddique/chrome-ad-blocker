import fs from 'fs';
import path from 'path';
import { MSG } from '../../src/utils/messaging.js';
import * as storage from '../../src/utils/storage.js';
import { createMockPlayer } from '../harness/mock-player.js';

const SRC = path.resolve(__dirname, '../../src');
const html = fs.readFileSync(path.join(SRC, 'popup.html'), 'utf8');
const css = fs.readFileSync(path.join(SRC, 'styles/popup.css'), 'utf8');

function loadPopupDom() {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.innerHTML = parsed.body.innerHTML;
}

function loadBackground() {
  jest.isolateModules(() => {
    require('../../src/background.js');
  });
}

function connect(tabId) {
  chrome.runtime.sendMessage = jest.fn((message) =>
    new Promise((resolve) => {
      chrome.runtime.onMessage.emit(message, { tab: { id: tabId } }, resolve);
    })
  );
}

function openTab(url, id = 7) {
  chrome.tabs.query = jest.fn(async () => [{ id, url }]);
  connect(id);
}

function loadPopup() {
  let popup;
  jest.isolateModules(() => {
    popup = require('../../src/popup.js');
  });
  return popup;
}

async function blockAds(tabId, platform, count, domain = 'ads.example.com') {
  const items = Array.from({ length: count }, () => ({ domain }));
  await chrome.runtime.sendMessage({ type: MSG.AD_BLOCKED, platform, items });
}

const text = (id) => document.getElementById(id).textContent;
const hidden = (id) => document.getElementById(id).hidden;

beforeEach(async () => {
  console.error.mockClear();
  loadBackground();
  loadPopupDom();
  await flushPromises();
});

describe('AT-15 popup rendering', () => {
  it('renders 0 blocked ads', async () => {
    openTab('https://www.primevideo.com/detail/x');
    await loadPopup().init(document);
    expect(text('count')).toBe('0');
    expect(document.querySelectorAll('#labels li')).toHaveLength(0);
    expect(hidden('domains-empty')).toBe(false);
    expect(text('hostname')).toBe('www.primevideo.com');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('renders 1 blocked ad with a singular platform label', async () => {
    openTab('https://www.primevideo.com/detail/x');
    await blockAds(7, 'prime-video', 1, 'securepubads.g.doubleclick.net');
    await loadPopup().init(document);
    expect(text('count')).toBe('1');
    expect(text('labels')).toBe('Blocked 1 Prime Video ad');
    expect(text('domains')).toContain('securepubads.g.doubleclick.net');
    expect(hidden('domains-empty')).toBe(true);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('renders 100+ blocked ads across platforms with every label and domain', async () => {
    openTab('https://www.hotstar.com/in');
    await blockAds(7, 'jio-hotstar', 120, 'ads.jiohotstar.com');
    await blockAds(7, 'prime-video', 31, 'doubleclick.net');
    await loadPopup().init(document);
    expect(text('count')).toBe('151');
    const labels = [...document.querySelectorAll('#labels li')].map((li) => li.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Blocked 120 Jio Hotstar ads', 'Blocked 31 Prime Video ads']));
    expect([...document.querySelectorAll('#domains li')].map((li) => li.textContent))
      .toEqual(['ads.jiohotstar.com120', 'doubleclick.net31']);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('shows only the current tab counts (no cross-tab leakage)', async () => {
    connect(1);
    await blockAds(1, 'prime-video', 5);
    openTab('https://www.hotstar.com/in', 2);
    await loadPopup().init(document);
    expect(text('count')).toBe('0');
  });

  it('renders text, never HTML, for hostile domain strings', async () => {
    openTab('https://www.hotstar.com/in');
    await blockAds(7, 'jio-hotstar', 1, '<img src=x onerror=alert(1)>');
    await loadPopup().init(document);
    expect(document.querySelector('#domains img')).toBeNull();
    expect(text('domains')).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('toggles and settings', () => {
  it('whitelist toggle writes the domain to sync storage and can be undone', async () => {
    openTab('https://www.primevideo.com/detail/x');
    await loadPopup().init(document);
    const toggle = document.getElementById('whitelist-toggle');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    await flushPromises();
    expect(await storage.getWhitelist()).toEqual(['www.primevideo.com']);
    expect(chrome.storage.sync.set).toHaveBeenCalled();
    expect(await storage.isBlockingEnabledFor('www.primevideo.com')).toBe(false);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    await flushPromises();
    expect(await storage.getWhitelist()).toEqual([]);
  });

  it('reflects an existing whitelist entry when opened', async () => {
    await storage.addToWhitelist('primevideo.com');
    openTab('https://www.primevideo.com/detail/x');
    await loadPopup().init(document);
    expect(document.getElementById('whitelist-toggle').checked).toBe(true);
  });

  it('reverts the toggle and shows a message when saving fails', async () => {
    openTab('https://www.primevideo.com/');
    await loadPopup().init(document);
    chrome.declarativeNetRequest.updateDynamicRules.mockRejectedValue(new Error('rules rejected'));
    const toggle = document.getElementById('whitelist-toggle');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    await flushPromises();
    expect(toggle.checked).toBe(false);
    expect(text('message')).toBe('rules rejected');
  });

  it('session and permanent disable persist in the right stores', async () => {
    openTab('https://www.primevideo.com/');
    await loadPopup().init(document);
    const session = document.getElementById('session-toggle');
    session.checked = true;
    session.dispatchEvent(new Event('change'));
    await flushPromises();
    expect(await storage.isSessionDisabled()).toBe(true);
    const permanent = document.getElementById('permanent-toggle');
    permanent.checked = true;
    permanent.dispatchEvent(new Event('change'));
    await flushPromises();
    expect((await storage.getSettings()).enabled).toBe(false);
  });

  it('settings button opens the options page', async () => {
    openTab('https://www.primevideo.com/');
    await loadPopup().init(document);
    document.getElementById('settings-button').click();
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalledTimes(1);
  });

  it('shows the filter-list warning when the bundled list was invalid', async () => {
    await storage.setHealth({ ok: false, error: 'corrupt' });
    openTab('https://www.primevideo.com/');
    await loadPopup().init(document);
    expect(hidden('warning')).toBe(false);
    expect(text('warning')).toMatch(/disabled/);
  });
});

describe('edge cases', () => {
  it.each([['chrome://newtab/'], ['chrome://extensions'], ['about:blank'], ['file:///a.html'], ['']])(
    'shows "Not available on this page" for %p and disables toggles',
    async (url) => {
      openTab(url);
      await loadPopup().init(document);
      expect(text('unavailable')).toBe('Not available on this page');
      expect(hidden('unavailable')).toBe(false);
      for (const id of ['whitelist-toggle', 'session-toggle', 'permanent-toggle']) {
        expect(document.getElementById(id).disabled).toBe(true);
      }
      expect(console.error).not.toHaveBeenCalled();
    }
  );

  it('handles no active tab', async () => {
    chrome.tabs.query = jest.fn(async () => []);
    await loadPopup().init(document);
    expect(hidden('unavailable')).toBe(false);
  });

  describe('service worker unavailable', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('retries once within 1 second and then renders', async () => {
      openTab('https://www.primevideo.com/');
      const handler = chrome.runtime.sendMessage;
      chrome.runtime.sendMessage = jest.fn()
        .mockRejectedValueOnce(new Error('Could not establish connection'))
        .mockImplementation(handler);
      const promise = loadPopup().init(document);
      await jest.advanceTimersByTimeAsync(499);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      await promise;
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(hidden('error')).toBe(true);
      expect(text('count')).toBe('0');
    });

    it('shows an error state when the retry also fails', async () => {
      openTab('https://www.primevideo.com/');
      chrome.runtime.sendMessage = jest.fn().mockRejectedValue(new Error('gone'));
      const promise = loadPopup().init(document);
      await jest.advanceTimersByTimeAsync(500);
      await promise;
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(hidden('error')).toBe(false);
      expect(text('error')).toMatch(/not responding/);
    });
  });
});

describe('auto start', () => {
  it('initializes itself when running inside an extension page', async () => {
    openTab('https://www.primevideo.com/');
    chrome.runtime.id = 'abcdefghijklmnopabcdefghijklmnop';
    loadPopup();
    await flushPromises();
    expect(text('hostname')).toBe('www.primevideo.com');
  });
});

describe('static checks', () => {
  it('contains no inline scripts, inline handlers or inline styles (MV3 CSP)', () => {
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/<style/i);
  });

  it('defines light and dark theme variables that follow the color scheme', () => {
    expect(css).toMatch(/:root\s*{[^}]*--bg:\s*#fff/);
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{[^}]*--bg:\s*#1e1f22/);
    expect(css).toMatch(/color-scheme:\s*light dark/);
  });
});

describe('popup open/close during playback', () => {
  it.each(['https://www.primevideo.com/detail/x', 'https://www.hotstar.com/in/movies/x'])(
    'does not touch the page or player on %s',
    async (url) => {
      openTab(url);
      const player = createMockPlayer(document, url.includes('hotstar') ? 'jio-hotstar' : 'prime-video');
      player.advance(5000);
      const before = player.root.outerHTML;
      const position = player.state.position;
      await loadPopup().init(document);
      loadPopupDom();
      document.body.append(player.root);
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
      expect(player.root.outerHTML).toBe(before);
      expect(player.state.position).toBe(position);
      expect(player.state.longestBlankMs).toBe(0);
    }
  );
});
