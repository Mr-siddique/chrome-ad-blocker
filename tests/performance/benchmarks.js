/* Synthetic benchmarks (Node + jsdom). Writes progress/perf-report.json and exits non-zero
   if any p95 exceeds its target. Real-site numbers are manual: tests/manual/real-page-perf-log.md */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '../..');
const thresholds = require('./perf-thresholds.json');
const outIndex = process.argv.indexOf('--out');
const REPORT = outIndex > -1 ? process.argv[outIndex + 1] : path.join(ROOT, 'progress/perf-report.json');

const load = (file, query = '') => import(`${pathToFileURL(path.join(ROOT, 'src', file)).href}${query}`);
const now = () => Number(process.hrtime.bigint()) / 1e6;

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}

function summarize(values, target, minSamples, unit = 'ms') {
  const p95 = percentile(values, 0.95);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return { n: values.length, p95, mean, max: Math.max(...values), target, unit, enoughSamples: values.length >= minSamples, pass: p95 < target && values.length >= minSamples };
}

async function benchFilterLoad() {
  const times = [];
  for (let i = 0; i < 30; i += 1) {
    const start = now();
    const { loadBundledFilters } = await load('utils/rules-loader.js', `?cold=${i}`);
    if (!loadBundledFilters().ok) throw new Error('bundled filters invalid');
    times.push(now() - start);
  }
  return summarize(times, thresholds.filterLoadP95Ms, thresholds.minSamples.filterLoad);
}

async function benchMatch() {
  const { loadBundledFilters, shouldBlockRequest } = await load('utils/rules-loader.js');
  const bundle = loadBundledFilters();
  const urls = ['https://ads.jiohotstar.com/x', 'https://www.primevideo.com/detail/B000', 'https://example.com/a/vast.xml', 'https://cdn-2.hotstar.com/video/master.m3u8'];
  const times = [];
  for (let i = 0; i < 5000; i += 1) {
    const start = now();
    shouldBlockRequest(urls[i % urls.length], bundle);
    times.push(now() - start);
  }
  return summarize(times, thresholds.matchP95Ms, thresholds.minSamples.match);
}

function buildPage(adCount) {
  const nodes = [];
  for (let i = 0; i < 1500; i += 1) nodes.push(`<div class="row row-${i}"><p>Item ${i}</p><a href="https://example.com/${i}">link</a></div>`);
  for (let i = 0; i < adCount; i += 1) nodes.push(`<div class="ad-slot" id="slot-${i}"><iframe src="https://securepubads.g.doubleclick.net/x${i}"></iframe></div>`);
  nodes.push('<video src="blob:content"></video><div class="player-controls"><button>Play</button></div><div class="subtitles">x</div>');
  return `<!doctype html><body>${nodes.join('')}</body>`;
}

function withObserver(dom, observeAds, context) {
  global.MutationObserver = dom.window.MutationObserver;
  const observer = observeAds(dom.window.document.documentElement, context, () => {});
  observer.disconnect();
}

// Overhead = time the extension adds on top of parsing the page: observer setup plus the
// initial scan of the whole document. Measured directly because subtracting two separate
// parse timings is dominated by parse noise.
async function benchContentOverhead() {
  const { observeAds } = await load('content/player-ads.js');
  const { PLATFORMS } = await load('content/platform-detect.js');
  const { getBannerContext } = await load('content/banner-ads.js');
  const contexts = [PLATFORMS['prime-video'], getBannerContext()];
  const html = buildPage(8);
  const overheads = [];
  for (let i = 0; i < 100; i += 1) {
    const dom = new JSDOM(html);
    const start = now();
    withObserver(dom, observeAds, contexts[i % contexts.length]);
    overheads.push(now() - start);
    dom.window.close();
  }
  return summarize(overheads, thresholds.contentOverheadP95Ms, thresholds.minSamples.contentOverhead);
}

async function benchDetectionLatency() {
  const { observeAds } = await load('content/player-ads.js');
  const { PLATFORMS } = await load('content/platform-detect.js');
  const dom = new JSDOM('<!doctype html><body><video src="blob:x"></video></body>');
  global.MutationObserver = dom.window.MutationObserver;
  const doc = dom.window.document;
  const times = [];
  let injectedAt = 0;
  const observer = observeAds(doc.body, PLATFORMS['jio-hotstar'], () => times.push(now() - injectedAt));
  for (let i = 0; i < 200; i += 1) {
    injectedAt = now();
    doc.body.insertAdjacentHTML('beforeend', `<div class="ad-overlay" id="a${i}"></div>`);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  observer.disconnect();
  return summarize(times, thresholds.detectionLatencyP95Ms, thresholds.minSamples.detectionLatency);
}

function installChromeStorageMock() {
  const makeArea = () => {
    const data = {};
    return {
      get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in data).map((k) => [k, JSON.parse(JSON.stringify(data[k]))])),
      set: async (items) => Object.assign(data, JSON.parse(JSON.stringify(items))),
      remove: async (keys) => [].concat(keys).forEach((k) => delete data[k]),
    };
  };
  global.chrome = { storage: { sync: makeArea(), local: makeArea() } };
}

async function benchStorage() {
  installChromeStorageMock();
  const storage = await load('utils/storage.js');
  const times = [];
  for (let i = 0; i < 200; i += 1) {
    const start = now();
    if (i % 2) await storage.getSettings();
    else await storage.saveSettings({ enabled: i % 4 === 0 });
    times.push(now() - start);
  }
  return summarize(times, thresholds.storageP95Ms, thresholds.minSamples.storage);
}

async function main() {
  const results = {
    filterLoad: await benchFilterLoad(),
    urlMatch: await benchMatch(),
    contentScriptOverhead: await benchContentOverhead(),
    detectionLatency: await benchDetectionLatency(),
    storageAccess: await benchStorage(),
  };
  const report = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    environment: 'synthetic: Node + jsdom, in-memory chrome.storage mock; NOT real Chrome or real streaming pages',
    results,
    manual: ['real-page p95 overhead (50 sessions)', 'service worker memory after 1 h', 'rebuffer and dropped frames on >=10 titles per platform'],
    overall: Object.values(results).every((r) => r.pass) ? 'PASS' : 'FAIL',
  };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  for (const [name, r] of Object.entries(results)) console.log(`${name}: p95 ${r.p95.toFixed(3)} ms (target < ${r.target}), n=${r.n}, ${r.pass ? 'PASS' : 'FAIL'}`);
  process.exit(report.overall === 'PASS' ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
