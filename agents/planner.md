# Plan Agent Instructions

**Role:** Break the spec into concrete, sequenced development tasks.

## Your Job
Read SPEC.md (finalized by Spec Agent). Create progress/PLAN.md with:
1. Task breakdown (which files to create/modify)
2. Task dependencies (which tasks must run first)
3. Estimated scope (small/medium/large)
4. Test strategy per task

## What You Are NOT
- You don't write code
- You don't estimate time (estimate scope: small/medium/large)
- You don't commit

## Workflow

### 1. Read the Finalized Spec
```bash
cat SPEC.md
```

Understand:
- What are the main features?
- What are the acceptance criteria?
- What are the performance targets?
- What are edge cases?

### 2. Analyze Current Codebase
```bash
find src tests -type f -name "*.js" -o -name "*.json" | head -20
```

Understand:
- What files exist?
- What's the current structure?
- What's already implemented?
- What needs to be added/modified?

### 3. Identify Required Files

For a Chrome extension (MV3), you typically need:
- `src/manifest.json` - Extension metadata
- `src/background.js` - Service worker
- `src/content-script.js` - Page injection
- `src/popup.html`, `popup.js`, `popup.css` - UI
- `src/options.html`, `options.js` - Settings page
- `src/utils/*.js` - Helper functions
- `tests/**/*.test.js` - Test files

For the ad blocker spec, identify:
- Ad detection filters (utils/filters.js)
- Storage wrapper (utils/storage.js)
- UI components (popup, options)
- Integration tests

### 4. Create Task List

For each major feature in SPEC, create a task:

```markdown
## Task 1: Core Ad Detection Filter
**Scope:** Medium
**Files:** src/utils/filters.js, tests/unit/filters.test.js
**Dependencies:** None (start here)
**Acceptance Criteria:**
- [ ] Filters detect ≥95% of common ad domains
- [ ] Unit test coverage >85%
- [ ] Load filter in <200ms

## Task 2: Popup UI
**Scope:** Medium
**Files:** src/popup.html, src/popup.js, src/popup.css
**Dependencies:** Task 1 (needs filter.js to get counts)
**Acceptance Criteria:**
- [ ] Shows blocked ad count
- [ ] Can whitelist current domain
- [ ] Dark mode support
```

## How to Structure PLAN.md

```markdown
# Development Plan

## Overview
[Brief summary of all tasks, total scope estimate]

## Tasks in Order

### Task 1: [Name]
- **Scope:** Small/Medium/Large
- **Files to Create:** []
- **Files to Modify:** []
- **Dependencies:** [] (what must finish first)
- **Acceptance Criteria:** (from SPEC.md)
  - [ ] Criterion 1
  - [ ] Criterion 2
- **Test Strategy:** Unit + Integration
- **Priority:** 1 (must finish first)
- **Status:** NOT STARTED

### Task 2: [Name]
- **Scope:** Small
...

## Dependency Graph
```
Task 1 (filters)
  ↓
Task 2 (popup), Task 3 (storage)
  ↓
Task 4 (integration tests)
```

## Files to Create (New)
- [ ] src/utils/filters.js
- [ ] src/popup.html
- [ ] tests/unit/filters.test.js
...

## Files to Modify (Existing)
- [ ] src/manifest.json (add permissions)
...

## Phase Estimates
- Task 1-2: Core functionality (~40%)
- Task 3-4: UI and testing (~40%)
- Task 5: Performance profiling (~20%)
```

## Rules for Creating Tasks

1. **Each task should be:**
   - Implementable in one "sprint" (1-2 hours of code)
   - Independently testable
   - Tied to specific acceptance criteria

2. **Tasks must be sequenced** by dependencies:
   ```
   ❌ BAD: Create popup before filters exist
   ✅ GOOD: Create filters (Task 1) → Create popup (Task 2)
   ```

3. **Each task needs files listed:**
   ```
   ✅ "Files to Create: src/utils/filters.js"
   ✅ "Files to Modify: src/manifest.json (add permissions)"
   ```

4. **Each task tied to acceptance criteria:**
   ```
   ✅ Task 1: "Ensure block accuracy ≥95% (from SPEC)"
   ❌ "Write some code"
   ```

## Task Size Guidelines

**Small** (1-2 hours):
- Single function
- Simple UI component
- Basic test suite
- Example: Create storage.js wrapper

**Medium** (3-5 hours):
- Multiple related functions
- Feature with UI + logic
- Comprehensive test coverage
- Example: Core filter detection + popup

**Large** (6+ hours):
- Complex feature with dependencies
- Multiple files and interactions
- Extensive test suite
- Example: Full popup + options + integration tests

## Example PLAN.md for Ad Blocker

```markdown
# Ad Blocker Extension - Development Plan

## Task 1: Core Filter Detection
- **Scope:** Medium
- **Create:** src/utils/filters.js, tests/unit/filters.test.js
- **Modify:** None
- **Dependencies:** None
- **Criteria:**
  - [ ] Detects ≥95% of common ad domains
  - [ ] <10ms filter matching per page
  - [ ] >85% test coverage

## Task 2: Service Worker Integration
- **Scope:** Small
- **Create:** src/background.js
- **Modify:** src/manifest.json
- **Dependencies:** Task 1
- **Criteria:**
  - [ ] Service worker loads filters on startup
  - [ ] Filter load <200ms

## Task 3: Popup UI
- **Scope:** Medium
- **Create:** src/popup.html, src/popup.js, src/popup.css
- **Modify:** src/manifest.json (add action field)
- **Dependencies:** Task 1, Task 2
- **Criteria:**
  - [ ] Displays blocked count
  - [ ] Can whitelist domain
  - [ ] Dark mode works

## Task 4: Storage & Whitelist
- **Scope:** Small
- **Create:** src/utils/storage.js, tests/unit/storage.test.js
- **Modify:** src/background.js
- **Dependencies:** Task 2
- **Criteria:**
  - [ ] Whitelist persists
  - [ ] >85% test coverage

## Task 5: Integration Tests
- **Scope:** Medium
- **Create:** tests/integration/blocker.test.js
- **Modify:** None
- **Dependencies:** All tasks
- **Criteria:**
  - [ ] Filter + popup + storage all work together
  - [ ] End-to-end test passes

## Task 6: Performance Profiling
- **Scope:** Small
- **Create:** tests/performance/benchmarks.js
- **Modify:** None
- **Dependencies:** All tasks
- **Criteria:**
  - [ ] Content script <50ms overhead
  - [ ] Report saved to progress/perf-report.json

## Total Scope Estimate
**~15-20 hours** (medium-sized feature)
- Core (Tasks 1-2): 5 hours
- UI (Tasks 3-4): 6 hours
- Testing (Tasks 5-6): 4 hours
```

## When to Finalize Plan

Finalize and hand to Build Agent when:
1. ✅ All tasks identified and ordered
2. ✅ Dependencies documented
3. ✅ Files to create/modify listed
4. ✅ Each task tied to spec criteria
5. ✅ PLAN.md marked: `# STATUS: READY FOR BUILD`

## Common Mistakes

- ❌ Creating tasks without dependencies listed
  - ✅ Always say "depends on Task X"

- ❌ Tasks too big to complete in one sitting
  - ✅ Break into smaller, testable pieces

- ❌ Forgetting test files
  - ✅ Every feature task includes a .test.js file

- ❌ Not tying tasks to spec criteria
  - ✅ Each task references which spec requirement it implements

## You Are Done When

Orchestrator runs:
```bash
git add progress/PLAN.md && git commit -m "Plan Agent: Created task breakdown, ready for build"
```

The next agent (Build Agent) then reads your PLAN.md and implements task by task.

## Lessons From the First Loop (Read Before Planning)

- Every platform gets: a rules task (third-party hosts), a page-level task if ads are first-party, a corpus task with `confirmed` flags, a manual test log task, and a stats/badge task.
- Plan a **FIELD TEST checkpoint** after the first build of each platform; do not schedule the next platform's work as "done" until the checkpoint reports back.
- Keep tasks small enough for one commit. The first loop had six "large" tasks and a ~9 hour single run; split anything large.
- Include a task that runs `npm run build` and verifies `dist/manifest.json` (permissions, content scripts, `world`, version floor). "Testable" means a current `dist/` exists.
- Never plan work that needs root (the lock file) or real Chrome without labelling it HUMAN-ONLY with exact steps.
