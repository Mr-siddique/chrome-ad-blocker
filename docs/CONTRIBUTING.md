# Contributing to Ad Blocker Extension

This project uses **spec-driven agentic development**. Here's how to contribute:

## Before You Code

1. **Understand the spec** - Read SPEC.md (the source of truth)
2. **Know the agents** - Check `agents/` directory
3. **Follow the loop** - SPECIFY → PLAN → BUILD → TEST → REVIEW

## During Agentic Development

The agents do most of the work. Your job:

### 1. Approve Spec (SPECIFY Phase)
```bash
orchestrator start-loop
# Review SPEC.md Spec Agent creates
# Answer: "Approve this spec?" (yes/no)
```

**Check:**
- Are acceptance criteria clear and testable?
- Are performance targets quantified?
- Are edge cases documented?

### 2. Approve Plan (PLAN Phase)
```bash
# After you approve spec
# Review progress/PLAN.md Plan Agent creates
# Answer: "Approve this plan?" (yes/no)
```

**Check:**
- Are tasks sequenced correctly?
- Do files to create/modify make sense?
- Is scope reasonable for each task?

### 3. Review Code (REVIEW Phase)
```bash
# After Build + Test complete
# Review progress/review-report.md Review Agent creates
# Answer: "Approve this code?" (yes/no)
```

**Check:**
- Are all acceptance criteria met?
- Is test coverage adequate (>80%)?
- Are performance targets met?
- Is code quality acceptable?

## Manual Development (Outside Loop)

If you want to develop manually (not using agents):

```bash
# Create feature branch
git checkout -b feature/your-feature

# Install dependencies
npm install

# Develop with tests
npm test -- --watch

# Before commit, run full suite
npm test
npm run benchmark

# If satisfied
git add .
git commit -m "Feature: your feature"

# Merge back when ready
git checkout main
git merge feature/your-feature
```

## Code Standards

### Chrome MV3 Compliance
- ✅ Use service workers (background.js)
- ✅ Use chrome.runtime for messaging
- ✅ Declare permissions in manifest.json
- ❌ No background pages
- ❌ No eval() or inline scripts
- ❌ No old MV2 APIs

### JavaScript Style
```javascript
// ✅ Good: Clear names
const blockedAds = filterAds(elements);

// ✅ Good: Focused functions (<30 lines)
function isAdElement(el) {
  return AD_PATTERNS.some(p => p.test(el.className));
}

// ✅ Good: Comments explain WHY, not WHAT
// Detect ads by common sizes (most efficient pattern)
const COMMON_AD_SIZES = [[300, 250], [728, 90], [970, 90]];

// ❌ Bad: Unclear names
const b = f(e);

// ❌ Bad: Long functions
function process() { ... 50 lines ... }

// ❌ Bad: Comment says obvious things
// Loop through extensions
for (const ext of extensions) { ... }
```

### Testing Requirements
- Every new file must have tests
- Aim for >85% coverage (minimum 80%)
- Test both happy path and edge cases
- Test file location: `tests/unit/<file>.test.js`

Example:
```javascript
// src/utils/filters.js
export function isAdElement(el) {
  return AD_PATTERNS.some(p => p.test(el.className));
}

// tests/unit/filters.test.js
describe('isAdElement', () => {
  it('detects ads by class pattern', () => {
    const el = document.createElement('div');
    el.className = 'ad-banner';
    expect(isAdElement(el)).toBe(true);
  });
  
  it('ignores legitimate content', () => {
    const el = document.createElement('div');
    el.className = 'content-block';
    expect(isAdElement(el)).toBe(false);
  });
});
```

## Making Changes to Spec

If you think the spec needs updating:

1. **Edit SPEC.md** with your proposed changes
2. **Run `orchestrator start-loop`** to re-refine
3. **Spec Agent** will clarify your changes
4. **You approve** the updated spec
5. **Loop restarts** from PLAN with new requirements

## If Tests Fail

```bash
# Run tests locally
npm test

# Check coverage
npm test -- --coverage

# Run specific test
npm test -- tests/unit/filters.test.js

# If a test keeps failing
# 1. Debug locally
# 2. Run orchestrator status (see where loop is)
# 3. orchestrator resume-loop (loop retries after your fix)
```

## If Performance Regresses

```bash
# Run benchmarks
npm run benchmark

# Compare to previous results
cat progress/test-results.json | jq '.performance'

# If too slow
# 1. Optimize the slow function
# 2. Run npm run benchmark again
# 3. orchestrator resume-loop (loop resumes)
```

## Git Workflow

### Commits by Agents (Atomic)
Agents create one commit per task:
```
Task 1: Core filter with domain detection
Task 2: Popup UI with whitelist button
Task 3: Storage wrapper and sync
```

### Your Commits (Manual Fixes)
If you fix something manually, be clear:
```bash
git commit -m "Fix: filter matching performance regression

- Optimize regex patterns (use compiled, not inline)
- Reduce DOM queries in detectAds()
- Benchmark improved from 15ms to 7ms
"
```

## Pull Request Process (If Contributing Upstream)

1. **Ensure tests pass** - `npm test` should succeed
2. **Ensure coverage** - Report >80% coverage
3. **Ensure performance** - Benchmarks meet targets
4. **Get Review Agent approval** - Check progress/review-report.md
5. **Create PR with findings** - Include review report in PR

## Debugging Agent Failures

**If Build Agent fails:**
```bash
# Check what it was trying to do
cat progress/PLAN.md | grep -A 10 "Task N:"

# See the error
git log --oneline | head -5

# Fix manually, then
orchestrator resume-loop
```

**If Test Agent fails:**
```bash
# Run tests locally to see actual error
npm test

# Find failing test
npm test -- tests/unit/file.test.js

# Fix the code or test
npm test (verify fix)

# Resume loop
orchestrator resume-loop
```

**If Review Agent rejects:**
```bash
# Read the blocker
cat progress/review-report.md | grep -A 5 "Blockers"

# Fix the issue (code or test)
# Commit the fix
git add . && git commit -m "Fix: [blocker description]"

# Resume loop for re-review
orchestrator resume-loop
```

## Performance Profiling

Use Chrome DevTools or `tests/performance/benchmarks.js`:

```javascript
// Quick benchmark
import { performance } from 'perf_hooks';

const start = performance.now();
blockAds(document.body);
console.log(`Took ${performance.now() - start}ms`);
```

Compare to SPEC.md targets:
- Content script: <50ms per page
- Filter matching: <10ms per 100 elements
- Filter load: <200ms on startup

## Documentation

Update these when you add features:
- **README.md** - Quick start and commands
- **docs/ARCHITECTURE.md** - System design changes
- **docs/AGENT_LOOP.md** - Loop workflow (rarely changes)
- **SPEC.md** - Only through the spec-driven process

## Questions?

- **How do agents work?** → Read docs/AGENT_LOOP.md
- **What's the system design?** → Read docs/ARCHITECTURE.md
- **How do I run the loop?** → Read README.md
- **What's in each agent?** → Read agents/*.md

---

**TL;DR:**
1. Read SPEC.md (source of truth)
2. Run `orchestrator start-loop` to let agents work
3. Approve at human gates (SPEC, PLAN, REVIEW)
4. Review `progress/` files to monitor progress
5. If needed, debug manually and `orchestrator resume-loop`
