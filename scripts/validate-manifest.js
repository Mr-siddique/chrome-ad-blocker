const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAX_NAME = 45;
const MAX_DESCRIPTION = 132;
const REQUIRED_ICON_SIZES = ['16', '48', '128'];

// Every requested permission needs a stated reason (Chrome Web Store review).
const PERMISSION_JUSTIFICATIONS = {
  storage: 'Saves the whitelist, settings and local block statistics.',
  declarativeNetRequest: 'Blocks ad requests with bundled static rules and user dynamic rules, without reading page traffic.',
  declarativeNetRequestFeedback: 'Reads which of our own block rules matched in a tab, only to show the blocked count and domains in the popup and badge.',
  activeTab: 'Lets the popup read the hostname of the current tab after the user opens it.',
};

// Bundle entries produced by webpack: manifest path -> source file.
const BUNDLE_SOURCES = {
  'background.js': 'background.js',
  'content-script.js': 'content-script.js',
  'popup.js': 'popup.js',
  'options.js': 'options.js',
};

function referencedFiles(manifest) {
  const files = [manifest.background && manifest.background.service_worker];
  for (const script of manifest.content_scripts || []) files.push(...(script.js || []), ...(script.css || []));
  files.push(manifest.action && manifest.action.default_popup, manifest.options_page);
  files.push(...Object.values(manifest.icons || {}), ...Object.values((manifest.action || {}).default_icon || {}));
  const resources = (manifest.declarative_net_request || {}).rule_resources || [];
  files.push(...resources.map((resource) => resource.path));
  return [...new Set(files.filter(Boolean))];
}

function checkBasics(manifest, errors) {
  if (manifest.manifest_version !== 3) errors.push('manifest_version must be 3');
  if (!manifest.name || manifest.name.length > MAX_NAME) errors.push(`name is required and must be <= ${MAX_NAME} characters`);
  if (!/^\d+(\.\d+){0,3}$/.test(manifest.version || '')) errors.push('version must be 1-4 dot-separated integers');
  if (!manifest.description || manifest.description.length > MAX_DESCRIPTION) {
    errors.push(`description is required and must be <= ${MAX_DESCRIPTION} characters`);
  }
  if (!manifest.background || !manifest.background.service_worker) errors.push('background.service_worker is required');
  if (manifest.background && (manifest.background.scripts || manifest.background.page)) errors.push('no background page/scripts in MV3');
  for (const size of REQUIRED_ICON_SIZES) if (!(manifest.icons || {})[size]) errors.push(`icons.${size} is required`);
}

function checkSecurity(manifest, errors) {
  const csp = (manifest.content_security_policy || {}).extension_pages || '';
  if (/unsafe-(inline|eval)|wasm-unsafe-eval/.test(csp)) errors.push('CSP must not allow unsafe-inline/unsafe-eval');
  if (/https?:\/\//.test(csp)) errors.push('CSP must not allow remote origins');
  for (const permission of manifest.permissions || []) {
    if (!PERMISSION_JUSTIFICATIONS[permission]) errors.push(`permission "${permission}" has no justification`);
  }
  if ((manifest.permissions || []).includes('webRequestBlocking')) errors.push('webRequestBlocking is not available in MV3');
  if ((manifest.host_permissions || []).some((host) => host === '<all_urls>' || host === '*://*/*')) {
    errors.push('broad host_permissions are not needed');
  }
}

function checkFiles(manifest, { srcDir, distDir }, errors) {
  for (const file of referencedFiles(manifest)) {
    const source = BUNDLE_SOURCES[file] ? path.join(srcDir, BUNDLE_SOURCES[file]) : path.join(srcDir, file);
    if (!fs.existsSync(source)) errors.push(`referenced file missing in src: ${file}`);
    if (distDir && !fs.existsSync(path.join(distDir, file))) errors.push(`referenced file missing in dist: ${file}`);
  }
}

function validateManifest(manifest, options = {}) {
  const errors = [];
  const paths = { srcDir: options.srcDir || path.join(ROOT, 'src'), distDir: options.distDir || null };
  checkBasics(manifest, errors);
  checkSecurity(manifest, errors);
  checkFiles(manifest, paths, errors);
  return errors;
}

function main() {
  const distIndex = process.argv.indexOf('--dist');
  const distDir = distIndex > -1 ? path.resolve(process.argv[distIndex + 1]) : null;
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest.json'), 'utf8'));
  const errors = validateManifest(manifest, { distDir });
  if (errors.length) {
    console.error(`Manifest validation failed:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Manifest OK${distDir ? ' (src and dist)' : ' (src)'}`);
}

if (require.main === module) main();

module.exports = { validateManifest, referencedFiles, PERMISSION_JUSTIFICATIONS };
