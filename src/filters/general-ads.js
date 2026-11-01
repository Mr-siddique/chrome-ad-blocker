import { buildRuleSet } from '../utils/filters.js';

// Real, widely known ad-serving / ad-network domains. All are 'vendor-known': listed from
// public knowledge of the ad-tech ecosystem and not verified against live traffic here.
const AD_HOSTS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'googletagservices.com',
  'adservice.google.com', '2mdn.net', 'amazon-adsystem.com', 'adnxs.com', 'rubiconproject.com',
  'pubmatic.com', 'openx.net', 'casalemedia.com', 'indexww.com', 'criteo.com', 'criteo.net',
  'taboola.com', 'outbrain.com', 'revcontent.com', 'mgid.com', 'zedo.com', 'adroll.com',
  'quantserve.com', 'scorecardresearch.com', 'ads-twitter.com', 'buysellads.com',
  'srv.carbonads.net', 'adcolony.com', 'applovin.com', 'unityads.unity3d.com', 'mopub.com',
  'smaato.net', 'vungle.com', 'chartboost.com', 'ironsrc.com', 'supersonicads.com',
  'startappservice.com', 'tapjoy.com', 'fyber.com', 'exoclick.com', 'popads.net',
  'propellerads.com', 'adsterra.com', 'juicyads.com', 'clickadu.com', 'hilltopads.net',
  'adcash.com', 'bidvertiser.com', 'infolinks.com', 'kontera.com', 'zergnet.com', 'nativo.com',
  'conversantmedia.com', 'vindicosuite.com', 'sitescout.com', 'rfihub.com', 'crwdcntrl.net',
  'demdex.net', 'everesttech.net', 'advertising.com', 'adblade.com', 'mediavine.com',
  'adthrive.com', 'ezoic.net', 'moatads.com', 'adsafeprotected.com', 'doubleverify.com',
  'serving-sys.com', 'innovid.com', 'flashtalking.com', 'adsrvr.org', 'krxd.net',
  'spotxchange.com', 'fwmrm.net', 'smartadserver.com', 'sharethrough.com', 'tremorhub.com',
  'springserve.com', 'bidswitch.net', 'contextweb.com', 'lijit.com', '33across.com', 'media.net',
  'yieldmo.com', 'triplelift.com', 'gumgum.com', 'sovrn.com', 'adform.net', 'mathtag.com',
  'tubemogul.com', 'brightroll.com', 'lkqd.net', 'stickyadstv.com', 'adsymptotic.com',
  'bluekai.com', 'exelator.com', 'rlcdn.com', 'agkn.com', '360yield.com', 'ml314.com',
  'teads.tv', 'undertone.com', 'trafficjunky.net', 'adtechus.com', 'inmobi.com',
  'inmobicdn.net', 'vserv.mobi', 'affle.com', 'colombiaonline.com', 'tyroo.com',
  'ads.yahoo.com', 'admob.com', 'ads.linkedin.com',
  'ads.pinterest.com', 'bat.bing.com', 'analytics.tiktok.com', 'ads.tiktok.com',
];

const RULES = AD_HOSTS.map((host, index) => ({
  id: `ga-${String(index + 1).padStart(3, '0')}`,
  host,
  confidence: 'vendor-known',
  confirmed: false,
}));

export const GENERAL_FILTER = {
  id: 'general',
  platform: 'general',
  label: 'web',
  version: '1.0.0',
  confirmed: false,
  platformHosts: [],
  platformPaths: [],
  rules: RULES,
  // Spec patterns .ad- .advertisement .advert- .banner-ad (class or id tokens); ad-free is
  // a common badge, not an ad.
  classPatterns: [
    /^ad-(?!free)/,
    /^advertisement/,
    /^advert-/,
    /^banner-ad/,
    /-banner-ad(-|$)/,
    /^adsbygoogle$/,
  ],
  adSelectors: [],
  sizes: [[300, 250], [728, 90], [970, 90]],
};

export const GENERAL_RULE_SET = buildRuleSet(RULES, {
  classPatterns: GENERAL_FILTER.classPatterns,
  sizes: GENERAL_FILTER.sizes,
});
