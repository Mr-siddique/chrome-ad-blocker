import { parseImport, serializeExport } from './utils/import-export.js';
import * as storage from './utils/storage.js';

const CATEGORIES = ['images', 'scripts', 'iframes'];

const byId = (doc, id) => doc.getElementById(id);

function showError(doc, message) {
  const el = byId(doc, 'error');
  el.textContent = message || '';
  el.hidden = !message;
  if (message) byId(doc, 'status').hidden = true;
}

function showStatus(doc, message) {
  const el = byId(doc, 'status');
  el.textContent = message || '';
  el.hidden = !message;
  if (message) byId(doc, 'error').hidden = true;
}

// textContent only: pattern and domain strings are untrusted input.
function renderList(doc, id, values, onRemove) {
  byId(doc, id).replaceChildren(...values.map((value) => {
    const item = doc.createElement('li');
    const label = Object.assign(doc.createElement('span'), { textContent: value });
    const button = Object.assign(doc.createElement('button'), { type: 'button', textContent: 'Remove' });
    button.setAttribute('aria-label', `Remove ${value}`);
    button.addEventListener('click', () => onRemove(value));
    item.append(label, button);
    return item;
  }));
}

export async function render(doc) {
  const ruleSet = await storage.getRuleSet();
  for (const key of CATEGORIES) byId(doc, `category-${key}`).checked = ruleSet.categories[key];
  renderList(doc, 'pattern-list', ruleSet.customPatterns, (value) => mutate(doc, () => storage.removeCustomPattern(value), 'Pattern removed'));
  renderList(doc, 'whitelist-list', ruleSet.whitelist, (value) => mutate(doc, () => storage.removeFromWhitelist(value), 'Domain removed'));
  return ruleSet;
}

async function mutate(doc, action, successMessage) {
  const result = await action();
  if (!result.ok) {
    showError(doc, result.error || 'Could not save the change');
    return result;
  }
  showStatus(doc, successMessage);
  await render(doc);
  return result;
}

function bindAddForm(doc, formId, inputId, add, message) {
  byId(doc, formId).addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = byId(doc, inputId);
    const result = await mutate(doc, () => add(input.value), message);
    if (result.ok) input.value = '';
  });
}

function bindCategories(doc) {
  for (const key of CATEGORIES) {
    const input = byId(doc, `category-${key}`);
    input.addEventListener('change', async () => {
      const result = await mutate(doc, () => storage.saveSettings({ categories: { [key]: input.checked } }), 'Settings saved');
      if (!result.ok) input.checked = !input.checked;
    });
  }
}

async function doImport(doc) {
  const parsed = parseImport(byId(doc, 'transfer-text').value);
  if (!parsed.ok) return showError(doc, parsed.error);
  const result = await storage.applyRuleSet(parsed.ruleSet);
  if (!result.ok) return showError(doc, result.error);
  await render(doc);
  const note = parsed.skipped ? ` ${parsed.skipped} invalid entr${parsed.skipped === 1 ? 'y was' : 'ies were'} skipped.` : '';
  return showStatus(doc, `Import complete.${note}`);
}

function bindTransfer(doc) {
  byId(doc, 'export-button').addEventListener('click', async () => {
    byId(doc, 'transfer-text').value = serializeExport(await storage.getRuleSet());
    showStatus(doc, 'Exported. Copy the text or save it to a file.');
  });
  byId(doc, 'import-button').addEventListener('click', () => doImport(doc));
  byId(doc, 'import-file').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) byId(doc, 'transfer-text').value = await file.text();
  });
}

function bindReset(doc) {
  const confirmBox = byId(doc, 'reset-confirm');
  byId(doc, 'reset-button').addEventListener('click', () => { confirmBox.hidden = false; });
  byId(doc, 'reset-cancel-button').addEventListener('click', () => { confirmBox.hidden = true; });
  byId(doc, 'reset-confirm-button').addEventListener('click', async () => {
    confirmBox.hidden = true;
    await mutate(doc, () => storage.resetToDefaults(), 'Defaults restored');
  });
}

export async function init(doc = document) {
  bindAddForm(doc, 'pattern-form', 'pattern-input', storage.addCustomPattern, 'Pattern added');
  bindAddForm(doc, 'whitelist-form', 'whitelist-input', storage.addToWhitelist, 'Domain added');
  bindCategories(doc);
  bindTransfer(doc);
  bindReset(doc);
  return render(doc);
}

// Only auto-start inside a real extension page; chrome.runtime.id is unset elsewhere.
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) init();
