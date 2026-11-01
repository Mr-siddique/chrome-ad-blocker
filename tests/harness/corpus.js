import fs from 'fs';
import path from 'path';
import { findAdElements } from '../../src/content/player-ads.js';

export const FIXTURES = path.resolve(__dirname, '../fixtures');

export function loadEndpoints(platform) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, platform, 'endpoints.json'), 'utf8'));
}

export function loadDomFixtures(platform) {
  const dir = path.join(FIXTURES, platform, 'dom');
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.html'))
    .sort()
    .map((name) => ({ name, html: fs.readFileSync(path.join(dir, name), 'utf8') }));
}

export function blockRate(results) {
  const blocked = results.filter((result) => result.blocked).length;
  return { blocked, total: results.length, rate: results.length ? blocked / results.length : 0 };
}

// A fixture is "blocked" when every element marked data-corpus-ad is found by the real
// player-ads detection and nothing unmarked (video, controls, subtitles) is flagged.
export function scanFixture(html, filter, ruleSet) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const found = findAdElements(doc.body, { filter, ruleSet }).map((entry) => entry.el);
  const marked = [...doc.body.querySelectorAll('[data-corpus-ad]')];
  const missed = marked.filter((el) => !found.includes(el));
  const falsePositives = found.filter((el) => !el.closest('[data-corpus-ad]'));
  const blocked = marked.length > 0 && missed.length === 0 && falsePositives.length === 0;
  return { blocked, marked: marked.length, missed: missed.length, falsePositives: falsePositives.length };
}
