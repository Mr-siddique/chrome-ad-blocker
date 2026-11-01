import { matchElement, parseUrl } from '../utils/filters.js';

// Never removed: playback surface, controls, progress, subtitles.
const PROTECTED_SELF =
  'button, input, track, [role="slider"], [role="progressbar"], [aria-live], ' +
  '[class*="subtitle" i], [class*="caption" i], [class*="control" i], ' +
  '[class*="progress" i], [class*="seek" i], [class*="volume" i]';
const PROTECTED_INNER =
  'video, [role="slider"], [role="progressbar"], [aria-live], ' +
  '[class*="subtitle" i], [class*="caption" i], [class*="progress" i]';
const CANDIDATES =
  '[class*="ad-"], [class*="atvwebplayersdk-ad"], [id*="ad-"], [data-ad-type], ' +
  '[class*="advert"], [id*="advert"], [class*="banner-ad"], [class*="adsbygoogle"], ' +
  '[data-testid], iframe, video, ins, img, script[src], embed, object';

export function describeElement(el) {
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    className: typeof el.className === 'string' ? el.className : '',
    src: el.getAttribute('src'),
    href: el.getAttribute('href'),
    width: Number(el.getAttribute('width')) || el.offsetWidth || 0,
    height: Number(el.getAttribute('height')) || el.offsetHeight || 0,
  };
}

export function classify(el, context) {
  const { filter, ruleSet } = context;
  if (filter.adSelectors.length && el.matches(filter.adSelectors.join(','))) return { reason: 'selector' };
  return matchElement(describeElement(el), ruleSet);
}

// A content <video> is protected; a video that is itself identified as an ad is not.
export function isProtected(el, context) {
  const root = el.ownerDocument.documentElement;
  if (el === root || el === el.ownerDocument.body) return true;
  if (el.matches('video')) return !classify(el, context);
  if (el.matches(PROTECTED_SELF)) return true;
  return Array.from(el.querySelectorAll(PROTECTED_INNER)).some((inner) => !classify(inner, context));
}

function domainOf(el, hit) {
  const parsed = parseUrl(el.getAttribute('src') || el.getAttribute('href') || '');
  if (parsed) return parsed.host;
  return hit.rule ? hit.rule.host : null;
}

const TAG_CATEGORY = { img: 'images', script: 'scripts', iframe: 'iframes' };

function categoryDisabled(el, context) {
  const category = TAG_CATEGORY[el.tagName.toLowerCase()];
  return Boolean(category && context.categories && context.categories[category] === false);
}

function inspect(el, context) {
  if (!el.isConnected || categoryDisabled(el, context)) return null;
  const hit = classify(el, context);
  if (!hit || isProtected(el, context)) return null;
  return { el, reason: hit.reason, domain: domainOf(el, hit) };
}

export function findAdElements(root, context) {
  const nodes = [];
  if (root.matches && root.matches(CANDIDATES)) nodes.push(root);
  if (root.querySelectorAll) nodes.push(...root.querySelectorAll(CANDIDATES));
  return nodes.map((el) => inspect(el, context)).filter(Boolean);
}

export function removeAdElements(root, context) {
  const removed = [];
  for (const found of findAdElements(root, context)) {
    if (!found.el.isConnected) continue;
    found.el.remove();
    removed.push({ reason: found.reason, domain: found.domain, tag: found.el.tagName.toLowerCase() });
  }
  return removed;
}

export function observeAds(root, context, onRemoved) {
  const handle = (target) => {
    const removed = removeAdElements(target, context);
    if (removed.length) onRemoved(removed);
  };
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') handle(mutation.target);
      mutation.addedNodes.forEach((node) => node.nodeType === 1 && handle(node));
    }
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'class', 'id', 'data-ad-type'],
  });
  handle(root);
  return observer;
}
