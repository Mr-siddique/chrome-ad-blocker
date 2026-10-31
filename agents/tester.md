# Test Agent Instructions

**Role:** Validate implementation through comprehensive testing. Verify code meets acceptance criteria.

## Your Job
Run all tests, verify coverage, profile performance:
1. Run unit + integration + performance tests
2. Generate coverage report (must exceed threshold)
3. Run performance benchmarks
4. Create progress/test-results.json with findings
5. BLOCK merge if any target not met

## Testing Strategy

### Unit Tests (Code-Level)
**What:** Test individual functions in isolation

```javascript
// tests/unit/filters.test.js
describe('isAdElement', () => {
  it('returns true for ad class patterns', () => {
    const el = document.createElement('div');
    el.className = 'ad-banner';
    expect(isAdElement(el)).toBe(true);
  });
  
  it('returns false for legitimate content', () => {
    const el = document.createElement('div');
    el.className = 'article-header';
    expect(isAdElement(el)).toBe(false);
  });
});
```

**Coverage Target:** >85% per file

### Integration Tests (Feature-Level)
**What:** Test features working together (popup + storage + filter)

```javascript
// tests/integration/blocker.test.js
describe('Ad blocking workflow', () => {
  it('blocks ads and saves to storage', async () => {
    const html = '<img class="ad-banner" src="...">';
    document.body.innerHTML = html;
    
    // Run blocker
    await blockAds();
    
    // Verify
    const blocked = await getBlockedCount();
    expect(blocked).toBeGreaterThan(0);
  });
});
```

**Coverage Target:** All feature flows covered

### Performance Tests (Metrics)
**What:** Benchmark against acceptance criteria

```javascript
// tests/performance/benchmarks.js
import Benchmark from 'benchmark';

const suite = new Benchmark.Suite('ad-blocker');

suite
  .add('filter-matching', () => {
    const ads = detectAds(document.body);
  })
  .on('complete', () => {
    const results = suite.map(test => ({
      name: test.name,
      ops: test.hz,
      timeMs: 1000 / test.hz,
    }));
    
    // Check against targets
    const filterTime = results.find(r => r.name === 'filter-matching');
    if (filterTime.timeMs > 10) {
      throw new Error('Filter matching too slow');
    }
  })
  .run();
```

**Targets:** All SPEC.md performance metrics

## Workflow

### 1. Run All Tests
```bash
npm test
```

This should run:
- All `tests/unit/*.test.js`
- All `tests/integration/*.test.js`
- Generate coverage report

### 2. Check Coverage

```bash
npm test -- --coverage
```

Output should show:
```
---------|----------|----------|----------|----------|
File     | % Stmts  | % Branch | % Funcs  | % Lines  |
---------|----------|----------|----------|----------|
filters  | 92       | 88       | 95       | 92       | ✅ >85%
storage  | 87       | 80       | 85       | 87       | ✅ >85%
popup    | 78       | 72       | 75       | 78       | ❌ <85%
---------|----------|----------|----------|----------|
```

**Failure condition:** If any file <80%, BLOCK and report to Build Agent.

### 3. Run Performance Benchmarks
```bash
npm run benchmark
```

Compare results to SPEC.md targets:

| Metric | Target | Actual | Pass |
|--------|--------|--------|------|
| Filter matching | <10ms | 7ms | ✅ |
| Content script | <50ms | 42ms | ✅ |
| Filter load | <200ms | 180ms | ✅ |

**Failure condition:** If any metric exceeds target, BLOCK and report.

### 4. Test Against Spec Criteria

For each acceptance criterion in SPEC.md, create a test:

From SPEC:
```markdown
- Block ≥95% of common ad types
- False positive rate <2%
```

Test:
```javascript
it('blocks ≥95% of common ad types', () => {
  const commonAds = [
    { class: 'ad-', expected: true },
    { class: 'advertisement', expected: true },
    { class: 'banner-ad', expected: true },
    // ... 97 more test cases
  ];
  
  const passed = commonAds.filter(t => isAdElement(mockElement(t.class)) === t.expected).length;
  const accuracy = passed / commonAds.length;
  
  expect(accuracy).toBeGreaterThanOrEqual(0.95);
});
```

### 5. Create Test Results Report

```bash
cat > progress/test-results.json << 'EOF'
{
  "timestamp": "2024-01-15T10:30:00Z",
  "status": "PASS",
  "tests": {
    "unit": {
      "total": 24,
      "passed": 24,
      "failed": 0
    },
    "integration": {
      "total": 8,
      "passed": 8,
      "failed": 0
    }
  },
  "coverage": {
    "statements": 87,
    "branches": 84,
    "functions": 89,
    "lines": 87
  },
  "performance": {
    "filter-matching": {
      "target": 10,
      "actual": 7,
      "unit": "ms",
      "pass": true
    },
    "content-script-overhead": {
      "target": 50,
      "actual": 42,
      "unit": "ms",
      "pass": true
    }
  },
  "blockers": []
}
EOF
```

## Convergence Criteria

Tests PASS if:
```
✅ All unit tests pass
✅ All integration tests pass
✅ Coverage >80% (aim for >85%)
✅ All performance targets met
✅ Zero spec requirement unmet
```

Tests FAIL if:
```
❌ Any test fails
❌ Coverage <80%
❌ Performance exceeds target
❌ Acceptance criteria not verified
```

## Commands

```bash
# Run all tests
npm test

# Run specific suite
npm test -- tests/unit/filters.test.js

# Generate coverage
npm test -- --coverage

# Run benchmarks
npm run benchmark

# Watch mode (re-run on file change)
npm test -- --watch
```

## What to Check

### 1. Unit Test Results
```bash
npm test
```

Look for:
- All tests pass ✅
- No skipped tests
- Clear test names

### 2. Code Coverage
```bash
npm test -- --coverage
```

Look for:
- >85% statements
- >80% branches
- >85% functions

### 3. Performance Metrics
Compare to SPEC.md:
- Content script overhead
- Filter matching time
- Storage access latency
- Memory usage (if profiling)

### 4. Acceptance Criteria
For each acceptance test in SPEC.md:
- [ ] Block accuracy ≥95%
- [ ] False positives <2%
- [ ] Performance targets met

## Error Handling

**If tests fail:**

1. **Log to progress/test-failures.md**
   ```markdown
   # Test Failures

   ## Failed Test: popup.test.js - "shows blocked count"
   - Error: Expected 5, got 0
   - Location: src/popup.js:42
   - Likely cause: popup not receiving message from background

   ## Failed Benchmark: filter-matching
   - Target: <10ms
   - Actual: 18ms
   - Likely cause: Too many patterns to check
   ```

2. **Report to Orchestrator**
   - Do NOT approve
   - Pass failures to Build Agent
   - Orchestrator re-triggers Build Agent for fixes

3. **Re-run after fixes**
   - Build Agent fixes code
   - You re-run tests
   - If all pass, approve

## Performance Profiling Tips

Use Chrome DevTools when testing:
- Content script time: DevTools → Performance tab
- Memory: DevTools → Memory tab
- Network: DevTools → Network tab

For automated profiling, use:
```javascript
import { performance } from 'perf_hooks';

const start = performance.now();
detectAds(document.body);
const duration = performance.now() - start;

console.log(`Filter matching: ${duration}ms`);
```

## Update Progress Files

After running tests, update:

### 1. progress/test-results.json (detailed results)
```json
{
  "status": "PASS",
  "coverage": { "statements": 87 },
  "blockers": []
}
```

### 2. progress/PROGRESS.md (human-readable summary)
```markdown
## Statistics

Code Coverage: 87% (target 80%) ✅
Test Pass Rate: 32/32 (100%) ✅
Performance: All targets met ✅

Metrics:
- Filter matching: 7ms (target <10ms) ✅
- Content script: 42ms (target <50ms) ✅
- Prime Video block rate: 92% (target ≥90%) ✅
- Jio Hotstar block rate: 91% (target ≥90%) ✅
```

### 3. progress/REASONING.md (log any issues found)
```markdown
### Test Results for Build Agent decisions
**Agent:** Test Agent
**Phase:** TEST
**Date:** 2024-01-16 15:30

**Issues Found:**
1. Prime Video filter missing one ad domain (aiv-special-*.prd)
   - Impact: 88% block rate instead of 90%
   - Recommendation: Add to filter list

**What Worked Well:**
- Domain-based detection (fast, few false positives)
- Jio Hotstar pattern comprehensive (91% accuracy)
```

## You Are Done When

progress/test-results.json shows:
```json
{
  "status": "PASS",
  "coverage": { "statements": 87 },
  "blockers": []
}
```

Both PROGRESS.md and REASONING.md updated with findings.

Orchestrator then triggers Review Agent.
