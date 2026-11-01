import { buildRuleSet } from '../utils/filters.js';

// Endpoints named in SPEC.md; shapes are NOT yet confirmed against live traffic.
const SPEC_ENDPOINTS = [
  ['ads.jiohotstar.com', ''],
  ['cdn-*.hotstar.com', '/ads'],
];

// Real ad-tech domains. Whether Jio Hotstar requests them is unverified ('vendor-known').
const VENDOR_HOSTS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'imasdk.googleapis.com',
  '2mdn.net', 'moatads.com', 'adsafeprotected.com', 'doubleverify.com', 'serving-sys.com',
  'innovid.com', 'flashtalking.com', 'adsrvr.org', 'rubiconproject.com', 'pubmatic.com',
  'openx.net', 'spotxchange.com', 'fwmrm.net', 'adnxs.com', 'casalemedia.com',
  'tremorhub.com', 'springserve.com', 'smartadserver.com', 'teads.tv', 'krxd.net',
  'bidswitch.net', 'inmobi.com', 'inmobicdn.net', 'vserv.mobi', 'affle.com',
  'colombiaonline.com', 'tyroo.com', 'tubemogul.com', 'brightroll.com', 'lkqd.net',
  'stickyadstv.com', 'adform.net', 'mathtag.com', 'indexww.com',
];

function makeRule(index, host, path, confidence) {
  const rule = { id: `jh-${String(index + 1).padStart(3, '0')}`, host, confidence, confirmed: false };
  if (path) rule.path = path;
  return rule;
}

const RULES = [
  ...SPEC_ENDPOINTS.map(([host, path]) => ['spec', host, path]),
  ...VENDOR_HOSTS.map((host) => ['vendor-known', host, '']),
].map(([confidence, host, path], index) => makeRule(index, host, path, confidence));

export const JIO_HOTSTAR_FILTER = {
  id: 'jio-hotstar',
  platform: 'jio-hotstar',
  label: 'Jio Hotstar',
  version: '1.0.0',
  confirmed: false,
  platformHosts: ['jiohotstar.com', 'hotstar.com'],
  platformPaths: [],
  rules: RULES,
  // Unverified against the live player.
  classPatterns: [/^ad-(overlay|banner|break|video|slot|container|countdown|indicator|label)(-|$)/],
  adSelectors: ['[data-testid="ad-overlay"]', '[data-ad-type]'],
};

export const JIO_HOTSTAR_RULE_SET = buildRuleSet(RULES, {
  classPatterns: JIO_HOTSTAR_FILTER.classPatterns,
});
