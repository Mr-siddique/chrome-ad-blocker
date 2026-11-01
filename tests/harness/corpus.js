import fs from 'fs';
import path from 'path';
import { matchElement } from '../../src/utils/filters.js';

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

export function describeElement(el) {
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id,
    className: typeof el.className === 'string' ? el.className : '',
    src: el.getAttribute('src'),
    href: el.getAttribute('href'),
    width: Number(el.getAttribute('width')) || 0,
    height: Number(el.getAttribute('height')) || 0,
  };
}

export function isDetected(el, filter, ruleSet) {
  if (filter.adSelectors.length && el.matches(filter.adSelectors.join(','))) return true;
  return Boolean(matchElement(describeElement(el), ruleSet));
}

// A fixture is "blocked" when every element marked data-corpus-ad is detected and
// nothing unmarked (video, controls, subtitles) outside a marked ad is flagged.
export function scanFixture(html, filter, ruleSet) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const all = [...doc.body.querySelectorAll('*')];
  const marked = all.filter((el) => el.hasAttribute('data-corpus-ad'));
  const missed = marked.filter((el) => !isDetected(el, filter, ruleSet));
  const falsePositives = all.filter(
    (el) => isDetected(el, filter, ruleSet) && !el.closest('[data-corpus-ad]')
  );
  const blocked = marked.length > 0 && missed.length === 0 && falsePositives.length === 0;
  return { blocked, marked: marked.length, missed: missed.length, falsePositives: falsePositives.length };
}
