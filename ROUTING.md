# Codebase Routing & Architecture Map

**Purpose:** Help agents understand folder structure, file purposes, and where to create new code.  
**Last Updated:** 2024-01-15

---

## Directory Structure Overview

```
chrome-ad-blocker/
├── Root Config Files
├── src/                          ← Extension source code
├── tests/                        ← Test suites
├── agents/                       ← Agent instructions
├── docs/                         ← Documentation
├── progress/                     ← Development tracking
├── .claude/                      ← Claude Code config
└── [miscellaneous]
```

---

## Detailed Routing Map

### 📂 Root Level Files

| File | Purpose | Created By | Last Modified |
|------|---------|-----------|---------------|
| `SPEC.md` | Feature specification (source of truth) | Human | 2024-01-15 |
| `README.md` | Project overview & quick start | Human | 2024-01-15 |
| `QUICKSTART.md` | 5-minute getting started | Human | 2024-01-15 |
| `ROUTING.md` | This file - codebase map | Human | 2024-01-15 |
| `package.json` | Dependencies & scripts | Human | 2024-01-15 |
| `jest.config.js` | Test configuration | Human | 2024-01-15 |
| `.gitignore` | Git exclusions | Human | 2024-01-15 |
| `.git/` | Git repository | Git | 2024-01-15 |

---

### 📂 src/ - Extension Source Code

**Purpose:** All browser extension code goes here.

| Folder | Contents | Who Creates | When |
|--------|----------|------------|------|
| `src/` | Root extension files | Build Agent | BUILD phase |
| `src/manifest.json` | Chrome MV3 manifest | Build Agent | BUILD phase |
| `src/background.js` | Service worker (main logic) | Build Agent | Task: Service Worker |
| `src/content-script.js` | Page injection script | Build Agent | Task: Content Script |
| `src/popup.html` | Popup UI markup | Build Agent | Task: Popup UI |
| `src/popup.js` | Popup logic & interactions | Build Agent | Task: Popup UI |
| `src/popup.css` | Popup styling | Build Agent | Task: Popup UI |
| `src/options.html` | Settings page (future) | Build Agent | Optional |
| `src/options.js` | Settings logic | Build Agent | Optional |

**Subfolders:**

```
src/utils/
├── filters.js           ← AD DETECTION LOGIC
│                          • isAdElement()
│                          • detectPrimeVideoAds()
│                          • detectJioHotstarAds()
│                          • AD_PATTERNS, AD_DOMAINS
│
├── storage.js           ← STORAGE WRAPPER
│                          • getWhitelist()
│                          • addToWhitelist()
│                          • getBlockedStats()
│
├── logger.js            ← DEBUG LOGGING (optional)
│                          • logAd()
│                          • logBlockEvent()
│
└── constants.js         ← SHARED CONSTANTS (optional)
                           • PRIME_VIDEO_DOMAINS
                           • JIO_HOTSTAR_DOMAINS
                           • AD_CONTAINER_SIZES

src/styles/
└── common.css           ← SHARED STYLES
                           • Dark mode variables
                           • Common UI classes
```

**How to Create Files:**
- **filters.js:** `Build Agent` → Task 1 & 2 (Prime Video + Jio Hotstar patterns)
- **storage.js:** `Build Agent` → Task: Storage & Whitelist
- **background.js:** `Build Agent` → Task: Service Worker
- **popup.\*:** `Build Agent` → Task: Popup UI
- **logger.js:** Optional helper, create if needed for debugging

---

### 📂 tests/ - Test Files

**Purpose:** All test suites go here. Created alongside source code.

```
tests/
├── setup.js                          ← JEST SETUP
│                                       • Mock Chrome API
│                                       • Mock DOM helpers
│
├── unit/
│   ├── filters.test.js              ← FILTER TESTS
│   │                                  • isAdElement() tests
│   │                                  • Prime Video pattern tests (50+ cases)
│   │                                  • Jio Hotstar pattern tests (30+ cases)
│   │                                  • False positive tests (1000+ cases)
│   │
│   ├── storage.test.js              ← STORAGE TESTS
│   │                                  • getWhitelist() tests
│   │                                  • addToWhitelist() tests
│   │                                  • Persistence tests
│   │
│   └── popup.test.js                ← POPUP TESTS
│                                      • Renders correctly
│                                      • Whitelist button works
│
├── integration/
│   ├── blocker.test.js              ← END-TO-END TESTS
│   │                                  • Background loads filters
│   │                                  • Content script detects ads
│   │                                  • Popup shows count
│   │                                  • Storage persists
│   │
│   └── streaming.test.js            ← STREAMING SPECIFIC TESTS
│                                      • Prime Video workflow
│                                      • Jio Hotstar workflow
│                                      • Ad injection scenarios
│
└── performance/
    └── benchmarks.js                ← PERFORMANCE TESTS
                                      • Filter matching time (<10ms)
                                      • Content script overhead (<50ms)
                                      • Filter load time (<200ms)
                                      • Memory usage tracking
```

**Test Creation Rules:**
1. **Create test alongside source:** Every `.js` file in `src/` has matching `.test.js` in `tests/`
2. **Coverage target:** >85% per file
3. **Naming:** Match source file name + `.test.js`
   - `src/utils/filters.js` → `tests/unit/filters.test.js`
   - `src/background.js` → `tests/unit/background.test.js` or `tests/integration/`

---

### 📂 agents/ - Agent Instructions

**Purpose:** Instructions for each agent phase.

| File | Agent | Purpose | When Used |
|------|-------|---------|-----------|
| `agents/orchestrator.md` | Orchestrator | Loop coordination | Runs continuously |
| `agents/spec.md` | Spec Agent | Spec refinement | SPECIFY phase |
| `agents/planner.md` | Plan Agent | Task planning | PLAN phase |
| `agents/builder.md` | Build Agent | Code implementation | BUILD phase |
| `agents/tester.md` | Test Agent | Test validation | TEST phase |
| `agents/reviewer.md` | Review Agent | Spec compliance | REVIEW phase |

**These files are READ-ONLY.** Agents use them as instructions, don't modify during development.

---

### 📂 docs/ - Documentation

| File | Purpose | Audience |
|------|---------|----------|
| `docs/ARCHITECTURE.md` | System design & component breakdown | Developers & agents |
| `docs/AGENT_LOOP.md` | How the agentic loop works | Everyone (especially humans) |
| `docs/CONTRIBUTING.md` | Contribution guidelines | Developers |

---

### 📂 progress/ - Development Tracking

**Purpose:** Agents write here to track progress and share state. Humans read here.

| File | Who Creates | Purpose |
|------|-------------|---------|
| `progress/status.md` | Orchestrator | Current phase & progress % |
| `progress/PROGRESS.md` | This file | Task completion tracking |
| `progress/ROUTING.md` | This file | Codebase architecture map |
| `progress/PLAN.md` | Plan Agent | Task breakdown & dependencies |
| `progress/REASONING.md` | All agents | Decision logs & learning |
| `progress/test-results.json` | Test Agent | Coverage, benchmarks, results |
| `progress/blockers.md` | Any agent | Issues preventing progress |
| `progress/review-report.md` | Review Agent | Spec compliance findings |
| `progress/coverage/` | Test Agent | Coverage reports (generated) |

---

### 📂 .claude/ - Claude Code Configuration

| File | Purpose |
|------|---------|
| `.claude/settings.json` | Development settings for Claude Code |

---

## How Agents Use This Map

### Plan Agent
```
1. Read ROUTING.md to understand folder structure
2. Know where to create files
3. Know which files go with which tests
4. Update PLAN.md with correct file paths
```

### Build Agent
```
1. Read ROUTING.md for folder structure
2. Create files in correct folders (src/utils/filters.js, NOT src/filters.js)
3. Create test files in tests/ with matching structure
4. If you need a new file not in map, document it in REASONING.md
5. Update this ROUTING.md with new files
```

### Test Agent
```
1. Know test file locations from ROUTING.md
2. Run tests/unit/*.test.js for coverage
3. Run tests/integration/*.test.js for E2E
4. Run tests/performance/benchmarks.js for perf
5. Report in progress/test-results.json
```

### Review Agent
```
1. Check that files are in correct locations
2. Verify test coverage per folder (ROUTING.md shows coverage targets)
3. Check no code ends up in wrong folder
```

---

## File Creation Checklist

When **Build Agent** creates a new file:

- [ ] **Location correct?** Check ROUTING.md for where it should go
- [ ] **Test file created?** Every src/*.js gets tests/corresponding/*.test.js
- [ ] **Updated ROUTING.md?** If new folder/file pattern, add to map
- [ ] **Documented in PLAN.md?** Already there, just mark DONE
- [ ] **Committed?** One commit per task
- [ ] **Added to progress/REASONING.md?** Explain why this file, how it works

---

## Common Paths (Quick Reference)

### Where to put ad detection code?
```
src/utils/filters.js
├── isAdElement(el)
├── detectPrimeVideoAds(elements)
├── detectJioHotstarAds(elements)
├── AD_PATTERNS = [...]
└── AD_DOMAINS = [...]
```

### Where to put storage code?
```
src/utils/storage.js
├── getWhitelist()
├── addToWhitelist(domain)
├── removeFromWhitelist(domain)
└── getBlockedStats()
```

### Where to put service worker code?
```
src/background.js
├── chrome.runtime.onInstalled (load filters)
├── chrome.runtime.onMessage (message handler)
└── chrome.storage (whitelist/stats manager)
```

### Where to put popup code?
```
src/popup.html (markup)
src/popup.js (logic)
src/popup.css (styling)
```

### Where to put tests?
```
tests/unit/filters.test.js (filter detection tests)
tests/unit/storage.test.js (storage tests)
tests/integration/blocker.test.js (E2E tests)
tests/performance/benchmarks.js (performance tests)
```

---

## File Dependency Graph

```
src/manifest.json
    ↓
    ├─→ src/background.js (service worker)
    │       ↓
    │       └─→ src/utils/filters.js (use filter functions)
    │       └─→ src/utils/storage.js (manage whitelist)
    │
    ├─→ src/content-script.js (inject into pages)
    │       ↓
    │       └─→ src/utils/filters.js (detect ads)
    │
    └─→ src/popup.html
            ↓
            └─→ src/popup.js
                    ↓
                    └─→ chrome.runtime (message background)
                    └─→ src/utils/storage.js (read whitelist)
```

**Implication:** Create in this order:
1. `filters.js` (no dependencies)
2. `storage.js` (no dependencies)
3. `background.js` (depends on filters, storage)
4. `content-script.js` (depends on filters)
5. `popup.js` (depends on storage)
6. Manifest ties them together

---

## Adding New Files

If an agent needs to create a file not in this map:

1. **Create the file** in the appropriate folder
2. **Document it here** (update ROUTING.md)
3. **Explain in REASONING.md** why it was needed
4. **Commit with message:** "Add: [file] for [purpose]"

Example:
```markdown
# New File: src/utils/logger.js
**Purpose:** Debug logging utility  
**Created by:** Build Agent (Task 7)  
**Why needed:** Help debug ad detection issues  
**Used by:** background.js, content-script.js
```

---

## How to Read This File

- **Find a folder?** Look in the directory structure sections
- **Need to create a file?** Check the "Where to put..." section
- **Need to understand dependencies?** Check the dependency graph
- **Agent needs to know structure?** Send this file to them

---

## Updating This File

Agents update ROUTING.md when:
- Creating a new folder (add to directory structure)
- Creating a new file pattern (add row to appropriate table)
- Discovering a better organization (refactor and document)

Humans update ROUTING.md when:
- Deciding on new architecture
- Changing folder structure
- Adding new features with different requirements

---

## Files added during BUILD (Build Agent, T1 to T18)

| File | Purpose |
|------|---------|
| `src/package.json` | `{"type":"module"}` so Node scripts can `import()` the ES-module sources |
| `src/utils/dnr-rules.js`, `src/utils/dynamic-rules.js` | Static (build-time) and dynamic (runtime) declarativeNetRequest rule builders |
| `src/utils/rules-loader.js`, `src/utils/messaging.js`, `src/utils/tab-stats.js`, `src/utils/import-export.js` | Bundled-list validation, typed messages, per-tab stats, rule import/export |
| `src/filters/{prime-video,jio-hotstar,vast-vpaid,general-ads}.js` | Filter lists (all unconfirmed against live traffic) |
| `src/content/{runner,platform-detect,player-ads,banner-ads}.js` | Content-script logic; `src/content-script.js` is a thin entry |
| `src/rules/{streaming,general}-rules.json` | Generated by `npm run build:rules`; do not hand-edit |
| `src/icons/icon{16,48,128}.png` | Generated placeholder icons |
| `scripts/build-rules.js`, `scripts/validate-manifest.js` | Rule generation and manifest validation |
| `tests/harness/{corpus,dnr-sim,mock-player}.js` | Test helpers (corpus scan, DNR urlFilter interpreter, mock player) |
| `tests/fixtures/**` | Corpora (see tests/fixtures/README.md) |
| `tests/performance/*`, `.github/workflows/ci.yml` | Benchmarks, thresholds, CI |
| `tests/manual/*.md` | Blank manual test logs (NOT RUN) |
