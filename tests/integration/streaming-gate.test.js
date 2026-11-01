import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { JIO_HOTSTAR_FILTER, JIO_HOTSTAR_RULE_SET } from '../../src/filters/jio-hotstar.js';
import { PRIME_VIDEO_FILTER, PRIME_VIDEO_RULE_SET } from '../../src/filters/prime-video.js';
import { shouldBlockUrl } from '../../src/utils/filters.js';
import { blockRate, loadDomFixtures, loadEndpoints, scanFixture } from '../harness/corpus.js';

const ROOT = path.resolve(__dirname, '../..');
const SUITES = {
  'AT-1': 'tests/integration/at1-prime-video-blockrate.test.js',
  'AT-2': 'tests/integration/at2-jio-hotstar-blockrate.test.js',
  'AT-3': 'tests/integration/at3-vast-vpaid.test.js',
  'AT-4': 'tests/integration/at4-playback-integrity.test.js',
  'AT-6': 'tests/integration/at6-dynamic-injection.test.js',
};
const PLATFORMS = [
  ['prime-video', PRIME_VIDEO_FILTER, PRIME_VIDEO_RULE_SET],
  ['jio-hotstar', JIO_HOTSTAR_FILTER, JIO_HOTSTAR_RULE_SET],
];

function runSuites() {
  const outputFile = path.join(ROOT, 'progress', '.streaming-gate-jest.json');
  const args = [
    require.resolve('jest/bin/jest'),
    '--coverage=false', '--json', `--outputFile=${outputFile}`, '--silent',
    ...Object.values(SUITES),
  ];
  const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  const json = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  fs.unlinkSync(outputFile);
  return { exitCode: run.status, json };
}

function suiteStatus(json, file) {
  const suite = json.testResults.find((result) => result.name.endsWith(file));
  if (!suite) return { passed: false, tests: 0, failed: 0 };
  const failed = suite.assertionResults.filter((test) => test.status === 'failed').length;
  return { passed: suite.status === 'passed', tests: suite.assertionResults.length, failed };
}

function corpusRates() {
  return Object.fromEntries(
    PLATFORMS.map(([platform, filter, ruleSet]) => {
      const endpoints = loadEndpoints(platform).items.map((item) => ({
        blocked: shouldBlockUrl(item.url, ruleSet),
      }));
      const dom = loadDomFixtures(platform).map((f) => scanFixture(f.html, filter, ruleSet));
      return [platform, blockRate([...endpoints, ...dom]).rate];
    })
  );
}

describe('Streaming gate (T8): AT-1, AT-2, AT-3, AT-4, AT-6', () => {
  const { exitCode, json } = runSuites();
  const rates = corpusRates();
  const suites = Object.fromEntries(Object.entries(SUITES).map(([id, file]) => [id, suiteStatus(json, file)]));
  const overall = exitCode === 0 && Object.values(suites).every((suite) => suite.passed);

  afterAll(() => {
    const report = {
      generatedBy: 'tests/integration/streaming-gate.test.js',
      corpusConfirmed: false,
      note: 'Rates are on the author-generated, unconfirmed corpus. AT-5 (manual real-site playback) has NOT been run.',
      thresholds: { streamingBlockRate: 0.9 },
      blockRates: rates,
      suites,
      overall: overall ? 'PASS' : 'FAIL',
    };
    fs.writeFileSync(path.join(ROOT, 'progress', 'streaming-gate-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  });

  it.each(Object.keys(SUITES))('%s suite passes', (id) => {
    expect(suites[id].tests).toBeGreaterThan(0);
    expect(suites[id].failed).toBe(0);
    expect(suites[id].passed).toBe(true);
  });

  it.each(PLATFORMS.map(([platform]) => platform))('%s streaming block rate is >= 90%%', (platform) => {
    expect(rates[platform]).toBeGreaterThanOrEqual(0.9);
  });

  it('overall gate passes', () => {
    expect(overall).toBe(true);
  });
});
