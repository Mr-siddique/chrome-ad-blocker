import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const { validateManifest, PERMISSION_JUSTIFICATIONS } = require('../../scripts/validate-manifest.js');

// These cover the automated half of AT-17. Loading the build in real Chrome and reading
// chrome://extensions and the service worker console is a documented MANUAL check (README).
describe('AT-17 manifest validation', () => {
  it('passes the Chrome Web Store style checks', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it.each([
    [{ ...manifest, manifest_version: 2 }, 'manifest_version'],
    [{ ...manifest, name: '' }, 'name'],
    [{ ...manifest, name: 'x'.repeat(46) }, 'name'],
    [{ ...manifest, version: 'one' }, 'version'],
    [{ ...manifest, description: '' }, 'description'],
    [{ ...manifest, description: 'x'.repeat(133) }, 'description'],
    [{ ...manifest, icons: {} }, 'icons.16'],
    [{ ...manifest, background: { scripts: ['a.js'] } }, 'service_worker'],
    [{ ...manifest, content_security_policy: { extension_pages: "script-src 'self' 'unsafe-eval'" } }, 'CSP'],
    [{ ...manifest, content_security_policy: { extension_pages: "script-src 'self' https://cdn.example.com" } }, 'remote'],
    [{ ...manifest, permissions: [...manifest.permissions, 'history'] }, 'justification'],
    [{ ...manifest, permissions: [...manifest.permissions, 'webRequestBlocking'] }, 'webRequestBlocking'],
    [{ ...manifest, host_permissions: ['<all_urls>'] }, 'host_permissions'],
    [{ ...manifest, options_page: 'missing.html' }, 'missing'],
  ])('rejects a bad manifest (%#)', (bad, fragment) => {
    expect(validateManifest(bad).join('\n')).toContain(fragment);
  });

  it('justifies every requested permission and nothing extra', () => {
    expect(Object.keys(PERMISSION_JUSTIFICATIONS).sort()).toEqual([...manifest.permissions].sort());
  });

  it('reports files missing from dist when a dist directory is given', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-dist-'));
    expect(validateManifest(manifest, { distDir: empty }).some((e) => e.includes('dist'))).toBe(true);
  });
});

describe('AT-17 service worker and scripts load without errors', () => {
  it('imports the service worker, registers listeners and logs no errors', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    console.error.mockClear();
    jest.isolateModules(() => {
      require('../../src/background.js');
    });
    await flushPromises();
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    expect(chrome.runtime.onStartup.addListener).toHaveBeenCalled();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it.each(['content-script.js', 'popup.js', 'options.js'])('imports %s without throwing', (file) => {
    expect(() => jest.isolateModules(() => require(path.join(SRC, file)))).not.toThrow();
  });

  it('every webpack entry maps to an existing source file and a manifest or html reference', () => {
    const config = require('../../webpack.config.js');
    const html = ['popup.html', 'options.html'].map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
    for (const [name, entry] of Object.entries(config.entry)) {
      expect(fs.existsSync(path.join(ROOT, entry))).toBe(true);
      const referenced = [manifest.background.service_worker, ...manifest.content_scripts.flatMap((c) => c.js)].includes(`${name}.js`) ||
        html.includes(`src="${name}.js"`);
      expect(referenced).toBe(true);
    }
  });

  it('webpack config never uses an eval-based devtool', () => {
    expect(require('../../webpack.config.js').devtool).toBe(false);
  });
});

describe('AT-17 production build', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-blocker-dist-'));
  const build = spawnSync(process.execPath, [
    require.resolve('webpack-cli/bin/cli.js'), '--mode=production', `--output-path=${outDir}`,
  ], { cwd: ROOT, encoding: 'utf8' });

  it('builds successfully', () => {
    expect(build.stderr).toBe('');
    expect(build.status).toBe(0);
  });

  it('emits every file referenced by the manifest', () => {
    expect(validateManifest(JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8')), { distDir: outDir })).toEqual([]);
  });

  it('bundles are classic scripts with no eval, remote imports or inline module syntax', () => {
    for (const file of ['background.js', 'content-script.js', 'popup.js', 'options.js']) {
      const code = fs.readFileSync(path.join(outDir, file), 'utf8');
      expect(code).not.toMatch(/\beval\(|new Function\(|^\s*import\s|^\s*export\s/m);
      expect(code).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    }
  });

  it('ships generated rules identical to the committed ones, within the static rule limit', () => {
    for (const name of ['streaming-rules.json', 'general-rules.json']) {
      const built = JSON.parse(fs.readFileSync(path.join(outDir, 'rules', name), 'utf8'));
      expect(built).toEqual(JSON.parse(fs.readFileSync(path.join(SRC, 'rules', name), 'utf8')));
      expect(built.length).toBeLessThan(30000);
    }
  });
});

describe('release gates', () => {
  it('keeps the coverage gate at or above 80% (not weakened)', () => {
    const { coverageThreshold } = require('../../jest.config.js');
    expect(coverageThreshold.global.lines).toBeGreaterThanOrEqual(80);
    expect(coverageThreshold.global.statements).toBeGreaterThanOrEqual(80);
    expect(coverageThreshold.global.functions).toBeGreaterThanOrEqual(80);
    expect(coverageThreshold.global.branches).toBeGreaterThanOrEqual(75);
  });
});
