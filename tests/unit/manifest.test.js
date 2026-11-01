const manifest = require('../../src/manifest.json');

const ALLOWED_PERMISSIONS = ['storage', 'declarativeNetRequest', 'declarativeNetRequestFeedback', 'activeTab', 'tabs', 'scripting'];

describe('manifest.json', () => {
  it('is Manifest V3 with a service worker and no background page', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe('background.js');
    expect(manifest.background.page).toBeUndefined();
    expect(manifest.background.scripts).toBeUndefined();
  });

  it('declares the Chrome version floor of 111', () => {
    expect(manifest.minimum_chrome_version).toBe('111');
  });

  it('requests only whitelisted permissions and never webRequestBlocking', () => {
    for (const permission of manifest.permissions) {
      expect(ALLOWED_PERMISSIONS).toContain(permission);
    }
    expect(manifest.permissions).not.toContain('webRequestBlocking');
    expect(manifest.permissions).not.toContain('webRequest');
  });

  it('uses declarativeNetRequest and storage', () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['declarativeNetRequest', 'storage'])
    );
  });

  it('registers streaming and general static rulesets, enabled by default', () => {
    const resources = manifest.declarative_net_request.rule_resources;
    expect(resources.map((r) => r.id)).toEqual(['streaming', 'general']);
    expect(resources.every((r) => r.enabled === true && r.path.startsWith('rules/'))).toBe(true);
  });

  it('has a popup action and options page', () => {
    expect(manifest.action.default_popup).toBe('popup.html');
    expect(manifest.options_page).toBe('options.html');
  });

  it('has a strict extension-page CSP without unsafe directives', () => {
    const csp = manifest.content_security_policy.extension_pages;
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/unsafe-(inline|eval)/);
  });

  it('contains no remote code or remote URLs in code-bearing fields', () => {
    const scripts = manifest.content_scripts.flatMap((entry) => entry.js || []);
    for (const file of [manifest.background.service_worker, ...scripts]) {
      expect(file).not.toMatch(/^[a-z]+:\/\//i);
    }
    expect(manifest.externally_connectable).toBeUndefined();
  });

  it('injects the content script in all frames at document_start', () => {
    const entry = manifest.content_scripts[0];
    expect(entry.js).toContain('content-script.js');
    expect(entry.all_frames).toBe(true);
    expect(entry.run_at).toBe('document_start');
  });
});
