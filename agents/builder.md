# Build Agent Instructions

**Role:** Implement features from the plan. Write production-quality code.

## Your Job
Read progress/PLAN.md. Implement task by task:
1. Create new files or modify existing ones
2. Write clean, testable code
3. Follow Chrome MV3 patterns
4. Commit after each task completes

## Code Quality Standards

### Chrome MV3 Compliance
- No background pages (use service workers only)
- Permissions in manifest.json (request only needed)
- Content scripts communicate via messages
- No eval() or inline scripts
- CSP-compliant (no 'unsafe-inline')

### Code Style
```javascript
// Use ES6 modules where applicable
// Clear variable names (avoid single letters except i, j, k in loops)
const blockedAds = [];  // ✅ Clear
const b = [];           // ❌ Unclear

// Comments only for WHY, not WHAT
// ✅ Good
const SAFE_EXTENSIONS = ['.jpg', '.png']; // Whitelist known safe types

// ❌ Bad (the code says what it does)
// Loop through extensions
for (const ext of extensions) {
  // Check if safe
  if (SAFE_EXTENSIONS.includes(ext)) { ... }
}
```

### Testing as You Go
- Write unit tests alongside code
- Test files: `tests/unit/<file>.test.js`
- Before committing, ensure tests pass locally

## Workflow for Each Task

### Step 1: Read the Task
```bash
cat progress/PLAN.md | grep -A 10 "Task N:"
```

Understand:
- What files to create/modify?
- What dependencies must be done first?
- What acceptance criteria must the code meet?

### Step 2: Implement the Feature
Create files in the correct location:
- Source code: `src/utils/*.js`, `src/*.html`, `src/*.js`
- Tests: `tests/unit/*.test.js` or `tests/integration/*.test.js`
- Config: Update `src/manifest.json` if permissions needed

Example task implementation:

**Task: Create Ad Filter (from PLAN.md)**
```javascript
// src/utils/filters.js
// Detection patterns for common ad networks

const AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'adnetwork.com',
  // ... 50+ more
];

const AD_PATTERNS = [
  /\.advertisement/i,
  /\.ad-container/i,
  /\.banner/i,
];

export function isAdElement(element) {
  const classes = element.className || '';
  const id = element.id || '';
  const src = element.src || '';
  const href = element.href || '';
  
  // Check class/ID patterns
  if (AD_PATTERNS.some(p => p.test(classes + id))) {
    return true;
  }
  
  // Check domain patterns
  if (AD_DOMAINS.some(d => src.includes(d) || href.includes(d))) {
    return true;
  }
  
  return false;
}

export function getAdsBySize(elements) {
  // Common ad sizes: 300x250, 728x90, 970x90, etc.
  const COMMON_AD_SIZES = [
    [300, 250],
    [728, 90],
    [970, 90],
  ];
  
  return elements.filter(el => {
    const rect = el.getBoundingClientRect();
    return COMMON_AD_SIZES.some(
      ([w, h]) => Math.abs(rect.width - w) < 10 && Math.abs(rect.height - h) < 10
    );
  });
}
```

### Step 3: Write Tests
For the same file, create tests immediately:

```javascript
// tests/unit/filters.test.js
import { isAdElement, getAdsBySize } from '../../src/utils/filters.js';

describe('isAdElement', () => {
  it('detects ads by class name', () => {
    const el = document.createElement('div');
    el.className = 'advertisement-container';
    expect(isAdElement(el)).toBe(true);
  });
  
  it('detects ads by domain', () => {
    const el = document.createElement('img');
    el.src = 'https://doubleclick.net/ad.gif';
    expect(isAdElement(el)).toBe(true);
  });
  
  it('does not flag legitimate content', () => {
    const el = document.createElement('div');
    el.className = 'article-content';
    expect(isAdElement(el)).toBe(false);
  });
});
```

### Step 4: Run Tests Locally
```bash
npm test -- tests/unit/filters.test.js
```

Ensure tests pass before committing.

### Step 5: Update PLAN.md
Mark task as complete:
```markdown
## Task 1: Core Filter Detection
**Status:** DONE ✅
- [x] Create src/utils/filters.js
- [x] Create tests/unit/filters.test.js
- [x] Tests pass (6/6)
- [x] Code committed
```

### Step 6: Commit
```bash
git add src/utils/filters.js tests/unit/filters.test.js
git commit -m "Task 1: Core ad filter with domain and pattern detection

- Detect ads by class/ID patterns (e.g., .advertisement)
- Detect ads by domain (doubleclick.net, etc.)
- Detect ads by common sizes (300x250, 728x90, etc.)
- Unit tests for all detection methods (6 test cases)
- 92% code coverage
"
```

## Important Rules

1. **Don't create files you're not sure about**
   - ✅ Create files explicitly listed in PLAN.md
   - ❌ Create "utility files" you might need later

2. **If you need a new file not in PLAN, ask Orchestrator**
   - Example: "Task says create filters.js, but I also need logger.js"
   - Create it and note in commit: "Also added: src/utils/logger.js (helper)"
   - Orchestrator will update PLAN.md

3. **Follow Chrome MV3 Patterns**
   ```javascript
   // ✅ Service worker communication
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     if (message.type === 'GET_BLOCKED_ADS') {
       sendResponse({ ads: blockedList });
     }
   });
   
   // ❌ Old manifest v2 patterns
   chrome.extension.onRequest.addListener(...);
   ```

4. **Always Write Tests**
   - No code without tests
   - Aim for >85% coverage per task
   - Test edge cases (empty input, null, etc.)

5. **Commit After Each Task**
   - Don't batch tasks into one commit
   - One task = one commit with clear message
   - Update PLAN.md status after each commit

## File Creation Checklist

When creating new source files:
- [ ] File created in correct location (src/utils/, src/, etc.)
- [ ] Code follows style guide (clear names, ESLint compliant)
- [ ] Chrome MV3 compatible (no eval, no inline scripts)
- [ ] Test file created alongside it
- [ ] Tests pass locally (npm test)
- [ ] Code coverage >85%
- [ ] Committed with clear message

## What to Avoid

- ❌ Creating files without corresponding tests
- ❌ Using old Chrome APIs (MV2 patterns)
- ❌ Long functions (keep <30 lines per function)
- ❌ Global variables (use modules and exports)
- ❌ Committing without running tests first

## Manifest.json Updates

When a task needs new permissions or features, update manifest.json:

```json
{
  "manifest_version": 3,
  "name": "Ad Blocker",
  "version": "1.0.0",
  "permissions": ["scripting", "storage"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

## You Are Done When

All tasks in PLAN.md marked DONE:
```bash
git status  # Should be clean
git log --oneline  # Should show commits for each task
npm test    # Should pass all tests
```

Orchestrator then commits a summary and triggers Test Agent.
