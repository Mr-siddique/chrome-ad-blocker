import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const thresholds = JSON.parse(fs.readFileSync(path.join(__dirname, 'perf-thresholds.json'), 'utf8'));
const REPORT = path.join(ROOT, 'progress', 'perf-report.json');

// Runs the same script as `npm run benchmark`, so CI and local runs agree.
describe('performance targets (synthetic Node + jsdom harness)', () => {
  const run = spawnSync(process.execPath, [path.join(__dirname, 'benchmarks.js'), '--out', REPORT], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));

  it('exits successfully and writes a report', () => {
    expect(run.status).toBe(0);
    expect(report.overall).toBe('PASS');
    expect(report.environment).toMatch(/synthetic/);
    expect(report.manual.length).toBeGreaterThan(0);
  });

  it.each([
    ['filterLoad', 'filterLoadP95Ms', 'filterLoad'],
    ['contentScriptOverhead', 'contentOverheadP95Ms', 'contentOverhead'],
    ['detectionLatency', 'detectionLatencyP95Ms', 'detectionLatency'],
    ['storageAccess', 'storageP95Ms', 'storage'],
    ['urlMatch', 'matchP95Ms', 'match'],
  ])('%s p95 is under its target with enough samples', (metric, targetKey, sampleKey) => {
    const result = report.results[metric];
    expect(result.n).toBeGreaterThanOrEqual(thresholds.minSamples[sampleKey]);
    expect(result.p95).toBeLessThan(thresholds[targetKey]);
    expect(result.pass).toBe(true);
  });
});
