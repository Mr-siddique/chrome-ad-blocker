import { isAllowlistedPlayerResource, isSubtitleUrl, parseUrl } from '../utils/filters.js';

// Each signature pairs a JS test with the equivalent substring urlFilter used for the
// generated declarativeNetRequest rule. The JS test is stricter (token boundaries), so the
// DNR rule is a superset of what the JS matcher blocks.
const SIGNATURES = [
  { type: 'vast', urlFilter: '/vast', test: /(^|[/_.-])vast\d*([/_.-]|$)/ },
  { type: 'vast', urlFilter: '/vmap', test: /(^|[/_.-])vmap\d*([/_.-]|$)/ },
  { type: 'vast', urlFilter: 'output=vast', test: /[?&]output=vast/ },
  { type: 'vast', urlFilter: 'output=xml_vast', test: /[?&]output=xml_vast/ },
  { type: 'vast', urlFilter: 'output=vmap', test: /[?&]output=(xml_)?vmap/ },
  { type: 'vast', urlFilter: 'vast=', test: /[?&]vast(version)?=/ },
  { type: 'vast', urlFilter: 'ad_type=vast', test: /[?&]ad_type=vast/ },
  { type: 'vast', urlFilter: 'adtype=vast', test: /[?&]adtype=vast/ },
  { type: 'vpaid', urlFilter: 'vpaid', test: /vpaid/ },
];

export const VAST_VPAID_FILTER = {
  id: 'vast-vpaid',
  version: '1.0.0',
  signatures: SIGNATURES.map((signature, index) => ({
    id: `vv-${String(index + 1).padStart(3, '0')}`,
    type: signature.type,
    urlFilter: signature.urlFilter,
  })),
};

export function classifyAdProtocolRequest(url) {
  const parsed = parseUrl(url);
  if (!parsed || isSubtitleUrl(url) || isAllowlistedPlayerResource(url)) return null;
  const target = `${parsed.path}${parsed.search}`.toLowerCase();
  const hit = SIGNATURES.find((signature) => signature.test.test(target));
  return hit ? hit.type : null;
}

export function isVastVpaidRequest(url) {
  return classifyAdProtocolRequest(url) !== null;
}
