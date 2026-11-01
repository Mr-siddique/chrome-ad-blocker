# Chrome Ad Blocker Extension

**Spec-driven agentic development** of a lightweight, privacy-first Chrome ad blocker.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Review and approve the spec
cat SPEC.md

# 3. Start the agentic development loop
npm run dev:loop

# Or manually trigger each phase:
# - Check status: orchestrator status
# - Start loop: orchestrator start-loop
```

## Architecture

**Spec-Driven Agentic Loop:**
```
SPECIFY → PLAN → BUILD → TEST → REVIEW → (iterate or commit)
```

Each phase has a dedicated agent:
- 🎯 **Spec Agent** (`agents/spec.md`) - Formalize requirements
- 📐 **Plan Agent** (`agents/planner.md`) - Break into tasks
- ⚙️ **Build Agent** (`agents/builder.md`) - Write code
- ✅ **Test Agent** (`agents/tester.md`) - Validate implementation
- 🔍 **Review Agent** (`agents/reviewer.md`) - Verify spec compliance
- 🎪 **Orchestrator** (`agents/orchestrator.md`) - Coordinate loop

## Project Structure

```
chrome-ad-blocker/
├── SPEC.md                    # Feature specification (source of truth)
├── agents/                    # Agent instruction files
│   ├── orchestrator.md
│   ├── spec.md
│   ├── planner.md
│   ├── builder.md
│   ├── tester.md
│   └── reviewer.md
├── src/                       # Extension source code
│   ├── manifest.json          # Chrome MV3 manifest
│   ├── background.js          # Service worker
│   ├── content-script.js      # Page injection
│   ├── popup.html/js/css      # Popup UI
│   ├── options.html/js        # Settings page
│   └── utils/                 # Helper modules
├── tests/                     # Test files
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── performance/           # Benchmarks
├── progress/                  # Agent-generated state
│   ├── status.md              # Current phase + progress
│   ├── PLAN.md                # Task breakdown
│   ├── test-results.json      # Test and performance results
│   └── review-report.md       # Code review findings
└── docs/                      # Documentation
```

## Development Workflow

### Human-Driven Phases

1. **Write Initial Spec** (You)
   - Edit `SPEC.md` with feature requirements
   - Run: `orchestrator start-loop`

2. **Review & Approve Plan** (You)
   - Orchestrator generates `progress/PLAN.md`
   - Review the task breakdown
   - Approve: `orchestrator proceed`

3. **Review & Approve Final Code** (You)
   - All agents complete (build, test, review)
   - Review `progress/review-report.md`
   - Approve: `orchestrator merge`

### Agent-Driven Phases

**Build Phase:** Build Agent implements task by task (auto)
- Creates/modifies files in `src/`
- Commits after each task
- Updates `progress/PLAN.md` with status

**Test Phase:** Test Agent validates (auto)
- Runs all tests
- Generates coverage report
- Creates `progress/test-results.json`
- BLOCKS if thresholds not met

**Review Phase:** Review Agent checks spec compliance (auto)
- Compares code against `SPEC.md`
- Verifies coverage and performance
- Creates `progress/review-report.md`
- BLOCKS if requirements unmet

## Loading the Unpacked Extension

```bash
npm install
npm run build          # regenerates src/rules/*.json, then bundles into dist/
npm run validate -- --dist dist   # manifest checks against the built files
```

1. Open `chrome://extensions` and turn on Developer mode.
2. Click "Load unpacked" and select the `dist/` folder.
3. Confirm there are no entries under "Errors" for the extension and open the service worker console ("service worker" link) to confirm it is clean. This real-Chrome check is MANUAL: the automated tests cover the manifest, the build output and module loading, not a real browser load (AT-17).
4. Open Prime Video or Jio Hotstar with an ad-supported account to try it. Manual protocols and blank logs are in `tests/manual/` (AT-5, whitelist sync, real-page performance); none of them has been run yet.

Notes:
- The bundled ad lists are author-built from the spec and public ad-tech knowledge. They have NOT been confirmed against live Prime Video / Jio Hotstar traffic (`confirmed: false`), so the corpus block rates reported by the tests are not real-world rates.
- Permissions: `storage` (settings, whitelist, local stats), `declarativeNetRequest` (static and dynamic block rules), `activeTab` (popup reads the current hostname). No host permissions; the extension makes no network requests.
- Edit filter lists in `src/filters/`, then run `npm run build:rules` to regenerate `src/rules/*.json` (the tests fail if they are stale).

## Commands

```bash
# Check current phase
orchestrator status

# Start from beginning
orchestrator start-loop

# Resume where we left off
orchestrator resume-loop

# Force next phase (override)
orchestrator trigger-phase PLAN

# Run tests manually
npm test

# Run benchmarks manually
npm run benchmark

# View test coverage
npm test -- --coverage
```

## Spec-Driven Development

The **SPEC.md** is the source of truth:
- All code must implement something in the spec
- All acceptance criteria must be tested
- Review Agent blocks if spec unmet
- Agents can't add features outside the spec

## Performance Targets

From `SPEC.md`:
| Metric | Target | Measured In |
|--------|--------|-------------|
| Block accuracy | ≥95% | tests/unit/filters.test.js |
| False positives | <2% | tests/unit/filters.test.js |
| Content script overhead | <50ms | tests/performance/benchmarks.js |
| Filter load time | <200ms | tests/performance/benchmarks.js |
| Test coverage | >80% | jest coverage report |

## Contributing (Manual Development)

If you want to develop manually (outside the agentic loop):

```bash
# Create feature branch
git checkout -b feature/your-feature

# Implement with tests
npm test -- --watch

# Before commit, run full suite
npm test
npm run benchmark

# Commit when ready
git commit -m "Feature: description"

# When ready, merge back to main
git checkout main
git merge feature/your-feature
```

## Debugging

**If agents fail:**
1. Check `progress/blockers.md` for error details
2. Read agent output in terminal
3. Fix the issue manually or ask for human intervention
4. Resume loop: `orchestrator resume-loop`

**If tests fail:**
- Run locally: `npm test`
- Check coverage: `npm test -- --coverage`
- Review test file to understand failure

**If performance regresses:**
- Run benchmarks: `npm run benchmark`
- Compare with `progress/test-results.json`
- Optimize the slow path

## Chrome MV3 Resources

- [Chrome Extensions docs](https://developer.chrome.com/docs/extensions/)
- [Manifest v3 migration guide](https://developer.chrome.com/docs/extensions/mv3/mv3-migration/)
- [Service worker in extensions](https://developer.chrome.com/docs/extensions/mv3/service_workers/)

## License

MIT

---

**Status:** Spec-driven development in progress. See `progress/status.md` for current phase.
