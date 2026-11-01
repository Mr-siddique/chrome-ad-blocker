import { MSG, sendWithRetry } from './utils/messaging.js';

// The spec asks for one retry within 1 second when the service worker is unavailable.
const RETRY_MS = 500;
const WEB_PROTOCOLS = ['http:', 'https:'];
const ERROR_TEXT = 'The ad blocker is not responding. Reopen this popup in a moment.';
const WARNING_TEXT = 'Blocking is disabled: the bundled filter list could not be loaded.';

export function hostnameOf(url) {
  try {
    const parsed = new URL(url);
    return WEB_PROTOCOLS.includes(parsed.protocol) ? parsed.hostname : null;
  } catch (error) {
    return null;
  }
}

function byId(doc, id) {
  return doc.getElementById(id);
}

function setHidden(doc, id, hidden) {
  byId(doc, id).hidden = hidden;
}

function fillList(doc, id, entries) {
  const list = byId(doc, id);
  list.replaceChildren(...entries.map((entry) => {
    const item = doc.createElement('li');
    // textContent only: domain strings come from page content and must never be parsed as HTML.
    item.append(...entry.map((text) => Object.assign(doc.createElement('span'), { textContent: text })));
    return item;
  }));
}

function setControlsDisabled(doc, disabled) {
  for (const id of ['whitelist-toggle', 'session-toggle', 'permanent-toggle']) byId(doc, id).disabled = disabled;
}

export function renderUnavailable(doc) {
  setHidden(doc, 'unavailable', false);
  setHidden(doc, 'stats', true);
  setControlsDisabled(doc, true);
}

export function renderError(doc) {
  byId(doc, 'error').textContent = ERROR_TEXT;
  setHidden(doc, 'error', false);
  setHidden(doc, 'stats', true);
  setControlsDisabled(doc, true);
}

function renderStats(doc, state) {
  byId(doc, 'count').textContent = String(state.stats.count);
  fillList(doc, 'labels', state.labels.map((label) => [label.text]));
  fillList(doc, 'domains', state.stats.domains.map((entry) => [entry.domain, String(entry.count)]));
  setHidden(doc, 'domains-empty', state.stats.domains.length > 0);
}

export function renderState(doc, state, hostname) {
  setHidden(doc, 'error', true);
  setHidden(doc, 'unavailable', true);
  setHidden(doc, 'stats', false);
  byId(doc, 'hostname').textContent = hostname;
  renderStats(doc, state);
  byId(doc, 'warning').textContent = WARNING_TEXT;
  setHidden(doc, 'warning', state.health.ok !== false);
  byId(doc, 'whitelist-toggle').checked = state.whitelisted;
  byId(doc, 'session-toggle').checked = state.sessionDisabled;
  byId(doc, 'permanent-toggle').checked = !state.settings.enabled;
  setControlsDisabled(doc, false);
}

async function toggle(doc, input, message) {
  const response = await sendWithRetry(message, RETRY_MS);
  if (response.ok) {
    byId(doc, 'message').textContent = '';
    return;
  }
  input.checked = !input.checked;
  byId(doc, 'message').textContent = response.error || 'Could not save the change.';
}

function bindControls(doc, hostname) {
  const whitelist = byId(doc, 'whitelist-toggle');
  whitelist.addEventListener('change', () =>
    toggle(doc, whitelist, { type: MSG.SET_WHITELIST, domain: hostname, whitelisted: whitelist.checked }));
  for (const [id, scope] of [['session-toggle', 'session'], ['permanent-toggle', 'permanent']]) {
    const input = byId(doc, id);
    input.addEventListener('change', () => toggle(doc, input, { type: MSG.SET_DISABLED, disabled: input.checked, scope }));
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0] ? tabs[0] : null;
}

export async function init(doc = document) {
  byId(doc, 'settings-button').addEventListener('click', () => chrome.runtime.openOptionsPage());
  const tab = await getActiveTab();
  const hostname = tab ? hostnameOf(tab.url) : null;
  if (!hostname) return renderUnavailable(doc);
  const state = await sendWithRetry({ type: MSG.GET_POPUP_STATE, tabId: tab.id, hostname }, RETRY_MS);
  if (!state.ok) return renderError(doc);
  renderState(doc, state, hostname);
  bindControls(doc, hostname);
  return state;
}

// Only auto-start inside a real extension page; chrome.runtime.id is unset elsewhere.
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) init();
