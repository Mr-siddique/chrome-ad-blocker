import { isAllowlistedPlayerResource, isSubtitleUrl, parseUrl } from '../utils/filters.js';

const PATH_DELIMITERS = ['^', '.', '_', '-'];
const withDelimiters = (segment) => PATH_DELIMITERS.map((delimiter) => `${segment}${delimiter}`);
const withVersions = (segment) => ['1', '2', '3', '4'].map((digit) => `${segment}${digit}`);

// Each signature pairs a JS test with the equivalent DNR urlFilters. The JS test is stricter
// (token boundaries), so the DNR rules are a superset of what the JS matcher blocks.
const SIGNATURES = [
  {
    type: 'vast',
    on: 'path',
    test: /(^|\/)(vast|vmap)\d*([/_.-]|$)/,
    urlFilters: ['/vast', '/vmap'].flatMap((s) => [...withDelimiters(s), ...withVersions(s)]),
  },
  { type: 'vast', on: 'search', test: /[?&]output=(xml_)?(vast|vmap)/, urlFilters: [
    '?output=vast', '&output=vast', '?output=xml_vast', '&output=xml_vast',
    '?output=vmap', '&output=vmap', '?output=xml_vmap', '&output=xml_vmap',
  ] },
  { type: 'vast', on: 'search', test: /[?&]vast(version)?=/, urlFilters: [
    '?vast=', '&vast=', '?vastversion=', '&vastversion=',
  ] },
  { type: 'vast', on: 'search', test: /[?&]ad_?type=vast/, urlFilters: [
    '?ad_type=vast', '&ad_type=vast', '?adtype=vast', '&adtype=vast',
  ] },
  { type: 'vpaid', on: 'url', test: /vpaid/, urlFilters: ['vpaid'] },
];

export const VAST_VPAID_FILTER = {
  id: 'vast-vpaid',
  version: '1.1.0',
  signatures: SIGNATURES.flatMap((signature) => signature.urlFilters.map((urlFilter) => ({
    type: signature.type,
    urlFilter,
  }))).map((entry, index) => ({ id: `vv-${String(index + 1).padStart(3, '0')}`, ...entry })),
};

function targetFor(signature, parsed) {
  const path = parsed.path.toLowerCase();
  const search = parsed.search.toLowerCase();
  if (signature.on === 'path') return path;
  return signature.on === 'search' ? search : `${path}${search}`;
}

export function classifyAdProtocolRequest(url) {
  const parsed = parseUrl(url);
  if (!parsed || isSubtitleUrl(url) || isAllowlistedPlayerResource(url)) return null;
  const hit = SIGNATURES.find((signature) => signature.test.test(targetFor(signature, parsed)));
  return hit ? hit.type : null;
}

export function isVastVpaidRequest(url) {
  return classifyAdProtocolRequest(url) !== null;
}
