import { buildRuleSet } from '../utils/filters.js';

// Endpoints named in SPEC.md; path and host shapes are NOT yet confirmed against live traffic.
const SPEC_ENDPOINTS = [
  ['aiv-cdn.amazon.com', '/ads'],
  ['ad-tier-*.prd.primevideo.*', ''],
];

// Real ad-tech domains. Whether Prime Video requests them is unverified, so they are
// marked 'vendor-known' rather than 'spec'.
const VENDOR_HOSTS = [
  'amazon-adsystem.com', 'mads.amazon.com', 'doubleclick.net', 'googlesyndication.com',
  'googleadservices.com', 'imasdk.googleapis.com', '2mdn.net', 'moatads.com',
  'adsafeprotected.com', 'doubleverify.com', 'serving-sys.com', 'innovid.com',
  'flashtalking.com', 'adsrvr.org', 'krxd.net', 'casalemedia.com', 'rubiconproject.com',
  'pubmatic.com', 'openx.net', 'spotxchange.com', 'fwmrm.net', 'adnxs.com', 'criteo.com',
  'criteo.net', 'teads.tv', 'smartadserver.com', 'sharethrough.com', 'tremorhub.com',
  'springserve.com', 'bidswitch.net', 'contextweb.com', 'indexww.com', 'lijit.com',
  '33across.com', 'media.net', 'yieldmo.com', 'triplelift.com', 'gumgum.com', 'sovrn.com',
  'adform.net', 'mathtag.com', 'advertising.com', 'tubemogul.com', 'brightroll.com',
  'lkqd.net', 'stickyadstv.com', 'adsymptotic.com', 'bluekai.com', 'exelator.com',
  'rlcdn.com', 'agkn.com', '360yield.com', 'ml314.com',
];

function makeRule(index, host, path, confidence) {
  const rule = { id: `pv-${String(index + 1).padStart(3, '0')}`, host, confidence, confirmed: false };
  if (path) rule.path = path;
  return rule;
}

const RULES = [
  ...SPEC_ENDPOINTS.map(([host, path]) => ['spec', host, path]),
  ...VENDOR_HOSTS.map((host) => ['vendor-known', host, '']),
].map(([confidence, host, path], index) => makeRule(index, host, path, confidence));

export const PRIME_VIDEO_FILTER = {
  id: 'prime-video',
  platform: 'prime-video',
  label: 'Prime Video',
  version: '1.0.0',
  confirmed: false,
  platformHosts: ['primevideo.com'],
  platformPaths: [{ hostPattern: 'amazon.*', path: '/gp/video' }],
  rules: RULES,
  // Class tokens and selectors for player overlays/banners. Unverified against the live player.
  classPatterns: [
    /^atvwebplayersdk-adtimeindicator/,
    /^ad-(overlay|banner|break|video|slot|container|countdown|indicator|label)(-|$)/,
  ],
  adSelectors: ['[data-testid="ad-overlay"]', '[data-ad-type]'],
};

export const PRIME_VIDEO_RULE_SET = buildRuleSet(RULES, {
  classPatterns: PRIME_VIDEO_FILTER.classPatterns,
});
