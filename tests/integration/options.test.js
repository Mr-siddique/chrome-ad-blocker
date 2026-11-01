import fs from 'fs';
import path from 'path';
import { buildDynamicRules } from '../../src/utils/dynamic-rules.js';
import * as storage from '../../src/utils/storage.js';

const html = fs.readFileSync(path.resolve(__dirname, '../../src/options.html'), 'utf8');
const css = fs.readFileSync(path.resolve(__dirname, '../../src/styles/options.css'), 'utf8');

function loadOptionsDom() {
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
}

function loadOptions() {
  let options;
  jest.isolateModules(() => {
    options = require('../../src/options.js');
  });
  return options;
}

function loadBackground() {
  jest.isolateModules(() => {
    require('../../src/background.js');
  });
}

const $ = (id) => document.getElementById(id);
const submit = (formId) => $(formId).dispatchEvent(new Event('submit', { cancelable: true }));
const change = (input, checked) => {
  input.checked = checked;
  input.dispatchEvent(new Event('change'));
};

async function addPattern(value) {
  $('pattern-input').value = value;
  submit('pattern-form');
  await flushPromises();
}

beforeEach(async () => {
  console.error.mockClear();
  loadOptionsDom();
  loadBackground();
  await flushPromises();
});

describe('AT-16 options page', () => {
  it('renders defaults', async () => {
    await loadOptions().init(document);
    expect(['images', 'scripts', 'iframes'].map((k) => $(`category-${k}`).checked)).toEqual([true, true, true]);
    expect($('pattern-list').children).toHaveLength(0);
  });

  describe('custom patterns', () => {
    it('adds a valid pattern, lists it and clears the input', async () => {
      await loadOptions().init(document);
      await addPattern('Ads.Example.com/Ads');
      expect([...$('pattern-list').querySelectorAll('span')].map((s) => s.textContent)).toEqual(['ads.example.com/ads']);
      expect($('pattern-input').value).toBe('');
      expect(await storage.getCustomPatterns()).toEqual(['ads.example.com/ads']);
      expect($('status').hidden).toBe(false);
    });

    it.each([['*'], ['**'], ['*.*'], ['*.com'], [''], ['bad pattern'], ['localhost']])(
      'rejects invalid pattern %p with an error message and does not save it',
      async (pattern) => {
        await loadOptions().init(document);
        await addPattern(pattern);
        expect($('error').hidden).toBe(false);
        expect($('error').textContent.length).toBeGreaterThan(5);
        expect(await storage.getCustomPatterns()).toEqual([]);
        expect($('pattern-list').children).toHaveLength(0);
      }
    );

    it('removes a pattern', async () => {
      await loadOptions().init(document);
      await addPattern('ads.example.com');
      $('pattern-list').querySelector('button').click();
      await flushPromises();
      expect(await storage.getCustomPatterns()).toEqual([]);
    });

    it('renders hostile text as text', async () => {
      await storage.setCustomPatterns(['x.com']);
      await storage.setCustomPatterns(['<img src=x onerror=alert(1)>.com']);
      await loadOptions().init(document);
      expect($('pattern-list').querySelector('img')).toBeNull();
    });
  });

  describe('per-domain whitelist', () => {
    it('adds and removes domains', async () => {
      await loadOptions().init(document);
      $('whitelist-input').value = 'https://www.Example.com/page';
      submit('whitelist-form');
      await flushPromises();
      expect(await storage.getWhitelist()).toEqual(['www.example.com']);
      expect($('whitelist-list').textContent).toContain('www.example.com');
      $('whitelist-list').querySelector('button').click();
      await flushPromises();
      expect(await storage.getWhitelist()).toEqual([]);
    });

    it('rejects an invalid domain with a message', async () => {
      await loadOptions().init(document);
      $('whitelist-input').value = 'not a domain';
      submit('whitelist-form');
      await flushPromises();
      expect($('error').textContent).toBe('Invalid domain');
    });
  });

  describe('category toggles', () => {
    it('persist, and become dynamic allow rules for that resource type', async () => {
      await loadOptions().init(document);
      change($('category-images'), false);
      await flushPromises();
      expect((await storage.getSettings()).categories).toEqual({ images: false, scripts: true, iframes: true });
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      expect(rules).toContainEqual(expect.objectContaining({
        action: { type: 'allow' },
        condition: { resourceTypes: ['image'] },
        priority: 4,
      }));
    });

    it('keeps other categories when one changes', async () => {
      await loadOptions().init(document);
      change($('category-images'), false);
      await flushPromises();
      change($('category-scripts'), false);
      await flushPromises();
      expect((await storage.getSettings()).categories).toEqual({ images: false, scripts: false, iframes: true });
    });

    it('buildDynamicRules maps categories, custom patterns and keeps ranges apart', () => {
      const rules = buildDynamicRules({
        whitelist: ['a.com'], blacklist: ['b.com'], customPatterns: ['ad-tier-*.prd.primevideo.*', 'ads.x.com/ads'],
        categories: { images: false, scripts: true, iframes: false },
      });
      const ids = rules.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(rules.filter((r) => r.action.type === 'allow').map((r) => r.condition.resourceTypes[0])).toEqual(['image', 'sub_frame']);
      expect(rules.filter((r) => r.priority === 3).length).toBeGreaterThan(2);
    });

    it('reverts the checkbox when saving fails', async () => {
      await loadOptions().init(document);
      chrome.storage.sync.set.mockRejectedValue(new Error('disk gone'));
      change($('category-images'), false);
      await flushPromises();
      expect($('category-images').checked).toBe(true);
      expect($('error').textContent).toBe('disk gone');
    });
  });

  describe('import and export', () => {
    async function populate() {
      await storage.addCustomPattern('ads.example.com');
      await storage.addToWhitelist('good.com');
      await storage.addToBlacklist('bad.net');
      await storage.saveSettings({ categories: { scripts: false } });
    }

    it('export followed by import yields an identical rule set', async () => {
      await populate();
      const before = await storage.getRuleSet();
      await loadOptions().init(document);
      $('export-button').click();
      await flushPromises();
      const exported = $('transfer-text').value;
      await storage.resetToDefaults();
      expect(await storage.getRuleSet()).not.toEqual(before);
      $('transfer-text').value = exported;
      $('import-button').click();
      await flushPromises();
      expect(await storage.getRuleSet()).toEqual(before);
      expect($('status').textContent).toBe('Import complete.');
    });

    it('rejects a malformed import and leaves existing rules unchanged', async () => {
      await populate();
      const before = await storage.getRuleSet();
      await loadOptions().init(document);
      for (const bad of ['{nope', '[]', '{"format":"streaming-ad-blocker-rules","version":1,"customPatterns":5}']) {
        $('transfer-text').value = bad;
        $('import-button').click();
        await flushPromises();
        expect($('error').hidden).toBe(false);
      }
      expect(await storage.getRuleSet()).toEqual(before);
    });

    it('skips invalid entries and shows the count', async () => {
      await loadOptions().init(document);
      $('transfer-text').value = JSON.stringify({
        format: 'streaming-ad-blocker-rules', version: 1, customPatterns: ['ads.example.com', '*', '*.*'],
        whitelist: [], blacklist: [], categories: { images: true, scripts: true, iframes: true },
      });
      $('import-button').click();
      await flushPromises();
      expect(await storage.getCustomPatterns()).toEqual(['ads.example.com']);
      expect($('status').textContent).toBe('Import complete. 2 invalid entries were skipped.');
    });

    it('rolls back to the previous rules if storage fails mid-import', async () => {
      await populate();
      const before = await storage.getRuleSet();
      await loadOptions().init(document);
      const realSet = chrome.storage.sync.set.getMockImplementation();
      let calls = 0;
      chrome.storage.sync.set.mockImplementation((items, cb) => {
        calls += 1;
        if (calls === 3 || calls === 4) return Promise.reject(new Error('QUOTA_BYTES quota exceeded'));
        return realSet(items, cb);
      });
      $('transfer-text').value = JSON.stringify({
        format: 'streaming-ad-blocker-rules', version: 1, customPatterns: ['other.example.com'],
        whitelist: ['x.com'], blacklist: [], categories: { images: false, scripts: true, iframes: true },
      });
      $('import-button').click();
      await flushPromises();
      expect($('error').textContent).toMatch(/full/i);
      chrome.storage.sync.set.mockImplementation(realSet);
      expect(await storage.getRuleSet()).toEqual(before);
    });

    it('loads a chosen file into the text area', async () => {
      await loadOptions().init(document);
      const input = $('import-file');
      Object.defineProperty(input, 'files', { configurable: true, value: [{ text: async () => 'file contents' }] });
      input.dispatchEvent(new Event('change'));
      await flushPromises();
      expect($('transfer-text').value).toBe('file contents');
      Object.defineProperty(input, 'files', { configurable: true, value: [] });
      input.dispatchEvent(new Event('change'));
    });
  });

  describe('reset', () => {
    it('asks for confirmation, then restores bundled defaults', async () => {
      await storage.addCustomPattern('ads.example.com');
      await storage.addToWhitelist('good.com');
      await storage.saveSettings({ categories: { images: false } });
      await loadOptions().init(document);
      $('reset-button').click();
      expect($('reset-confirm').hidden).toBe(false);
      expect(await storage.getCustomPatterns()).toEqual(['ads.example.com']);
      $('reset-confirm-button').click();
      await flushPromises();
      expect(await storage.getRuleSet()).toEqual({
        customPatterns: [], whitelist: [], blacklist: [],
        categories: { images: true, scripts: true, iframes: true },
      });
      expect($('category-images').checked).toBe(true);
      expect($('reset-confirm').hidden).toBe(true);
    });

    it('cancel keeps everything', async () => {
      await storage.addCustomPattern('ads.example.com');
      await loadOptions().init(document);
      $('reset-button').click();
      $('reset-cancel-button').click();
      expect($('reset-confirm').hidden).toBe(true);
      expect(await storage.getCustomPatterns()).toEqual(['ads.example.com']);
    });

    it('reports a failure to reset', async () => {
      await loadOptions().init(document);
      chrome.storage.sync.set.mockRejectedValue(new Error('disk gone'));
      $('reset-confirm-button').click();
      await flushPromises();
      expect($('error').textContent).toBe('disk gone');
    });
  });

  describe('AT-14 settings persistence', () => {
    it('survives a simulated extension reload', async () => {
      await loadOptions().init(document);
      await addPattern('ads.example.com');
      change($('category-iframes'), false);
      await flushPromises();
      jest.resetModules();
      loadOptionsDom();
      await loadOptions().init(document);
      expect($('category-iframes').checked).toBe(false);
      expect($('pattern-list').textContent).toContain('ads.example.com');
    });
  });

  describe('background applies storage changes', () => {
    it('rebuilds dynamic rules when the options page edits storage', async () => {
      await loadOptions().init(document);
      await addPattern('ads.example.com');
      await flushPromises();
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      expect(rules.some((r) => r.condition.urlFilter === '||ads.example.com^')).toBe(true);
    });

    it('ignores unrelated storage areas and keys, and survives a rules failure', async () => {
      const calls = chrome.declarativeNetRequest.updateDynamicRules.mock.calls.length;
      await chrome.storage.local.set({ whitelist: ['x'] });
      await chrome.storage.sync.set({ unrelated: 1 });
      await flushPromises();
      expect(chrome.declarativeNetRequest.updateDynamicRules.mock.calls.length).toBe(calls);
      chrome.declarativeNetRequest.updateDynamicRules.mockRejectedValue(new Error('rules rejected'));
      await storage.addToWhitelist('good.com');
      await flushPromises();
      expect(console.error).toHaveBeenCalled();
    });
  });

  it('options page has no inline scripts or styles and supports dark mode', () => {
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/i);
    expect(html).not.toMatch(/\son[a-z]+=|\sstyle=|<style/i);
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)/);
  });

  it('auto-starts inside an extension page', async () => {
    chrome.runtime.id = 'abcdefghijklmnopabcdefghijklmnop';
    loadOptions();
    await flushPromises();
    expect($('category-images').checked).toBe(true);
  });
});
