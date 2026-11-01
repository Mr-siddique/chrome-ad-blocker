# STATUS: READY FOR BUILD

# Development Plan - Chrome Ad Blocker (MV3)

Source: SPEC.md (FINALIZED, AT-1 to AT-17). Planned by the Plan Agent. Build must not start until a human changes the status line above to READY FOR BUILD.

## Overview
- 18 tasks (T1 to T18), sequenced streaming-first: scaffold, filter engine, Prime Video, Jio Hotstar, VAST/VPAID, network blocking and service worker, player DOM handling, then storage/messaging, general banners, false positives, UI, edge cases, performance, release gates.
- Scope mix (no time estimates): 3 Small, 9 Medium, 6 Large.
- Streaming gate: T3 to T8 (plus T11 FP check) must pass before any general-web (T10) work merges. Per spec precedence, a general-ad change that drops a streaming rate below 90% or breaks playback is rejected.
- Current state: src/ has only empty `styles/` and `utils/`; tests/ has `setup.js` and empty `unit/`, `integration/`, `performance/`. Nothing is implemented. package.json and jest.config.js exist (jsdom, coverage threshold 80/75/80/80, roots `tests/`, setup `tests/setup.js`). package.json `build`/`dev` scripts reference webpack but there is no `webpack.config.js` or babel config yet.

## Planning Assumptions (spec open items left unanswered by the human; Spec Agent defaults used)
1. **Server-side stitched ads:** counted in the corpus, 90% target applies, unblockable ones are not claimed as blocked (spec edge-case table). Corpus must include some stitched items, flagged `stitched: true`, so the rate is honest.
2. **Chrome version floor:** v90 per spec Constraints. Consequence: use only APIs available in v90 (declarativeNetRequest static + dynamic rules, `chrome.action`, `chrome.storage`). `chrome.storage.session` (v102) and `declarativeNetRequest.getMatchedRules` (v111) are NOT assumed; session-disable state uses `storage.local` flag cleared in `runtime.onStartup`; block counts come from content-script DOM removals plus a dev-only `onRuleMatchedDebug` path. Flag to Review Agent if the floor is raised.
3. **JS profiling tool:** Node `perf_hooks` + `benchmark` (already a dependency) for unit/harness timings, and the Chrome DevTools Protocol via a documented manual procedure for real-page p95 and memory. No new runtime dependencies. Real-page numbers (50 sessions, 1 h memory) are MANUAL and logged.
4. **Ad corpora:** the Build Agent authors representative endpoint and DOM fixtures from the spec's named endpoints; they are marked `confirmed: false` until Build/Test agents validate against live captures (spec assumption). Corpora are committed and versioned under `tests/fixtures/`.
5. **Build tooling:** webpack is kept as the packaging tool (already in package.json); rule JSON is generated at build time from the filter lists (no runtime network).

## Tasks in Order

### T1: Project scaffolding, manifest, test infrastructure
- **Scope:** Small
- **Priority:** 1
- **Files to Create:** `src/manifest.json`, `webpack.config.js`, `babel.config.js`, `.eslintrc.json`, `tests/fixtures/README.md` (corpus format/versioning), `tests/unit/manifest.test.js`
- **Files to Modify:** `tests/setup.js` (add mocks: `chrome.action`, `chrome.declarativeNetRequest`, `chrome.storage.onChanged`, `chrome.runtime.openOptionsPage`, `chrome.runtime.onStartup/onInstalled`, `chrome.tabs.onRemoved/onUpdated`, `chrome.webNavigation`; keep existing mocks)
- **Dependencies:** None
- **Satisfies:** AT-17 (manifest half), foundation for AT-12
- **Notes:** manifest MV3, `minimum_chrome_version: "90"`, service worker, declarativeNetRequest with static ruleset ids, content script matches for Prime Video and Jio Hotstar hosts plus `<all_urls>` general script, `action` popup, `options_page`, minimal permissions (`storage`, `declarativeNetRequest`, `tabs` or `activeTab`, `scripting` only if used). No remote code, no network calls.
- **Test Strategy:** Unit: manifest.json schema checks (MV3, service_worker, version floor, permission whitelist, no `webRequestBlocking`, no remote URLs). `npm test` runs green with zero tests failing.
- **Status:** DONE (8 tests)

### T2: Filter engine core (matcher, pattern parsing, validation)
- **Scope:** Medium
- **Priority:** 2
- **Files to Create:** `src/utils/filters.js`, `src/utils/patterns.js` (parse/validate custom patterns, reject match-all like `*`), `tests/unit/filters.test.js`, `tests/unit/patterns.test.js`
- **Files to Modify:** None
- **Dependencies:** T1
- **Satisfies:** foundation for AT-1, AT-2, AT-3, AT-7, AT-8, AT-16 (invalid pattern rejection), AT-10 (load time design), AT-12
- **Notes:** pure functions, no chrome APIs: `matchUrl(url, ruleSet)`, `matchElement(descriptor, ruleSet)`, host-indexed lookup (hash by registrable domain) for speed, `isAllowlistedPlayerResource()` guard for subtitles/manifests/content segments, `validatePattern()`.
- **Test Strategy:** Unit with table-driven cases; boundary cases for lookalike domains (`notads.jiohotstar.com.evil`), empty/malformed URLs, match-all rejection; 85%+ coverage of both files; micro-benchmark asserting single-match speed.
- **Status:** DONE (60 tests total, 98% coverage)

### T3: Prime Video filter list, ad corpus, block-rate test (STREAMING, FIRST)
- **Scope:** Large
- **Priority:** 3
- **Files to Create:** `src/filters/prime-video.js` (>=50 ad endpoint patterns incl. `aiv-cdn.amazon.com/ads`, `ad-tier-*.prd.primevideo.*`, embedded ad networks; DOM selectors for overlays/banners), `tests/fixtures/prime-video/endpoints.json` (>=50 items), `tests/fixtures/prime-video/dom/*.html` (>=20 fixtures: pre-roll, mid-roll, bumper, incl. some stitched flagged), `tests/unit/prime-video-filter.test.js`, `tests/integration/at1-prime-video-blockrate.test.js`
- **Files to Modify:** `src/utils/filters.js` (register platform list if needed)
- **Dependencies:** T2
- **Satisfies:** AT-1 (>=90%), part of AT-6 (static ads), spec Core Detection unit-test minimum (>=50 endpoints)
- **Test Strategy:** Corpus replay computes blocked/total and asserts >=0.90 with the ratio printed; per-item failure list output for triage; unit test asserts >=50 endpoint patterns exist and each named spec endpoint matches; guard test that media/subtitle/manifest URLs fixtures are NOT matched (feeds T11).
- **Status:** DONE (82 tests total, corpus rate 92.1%)

### T4: Jio Hotstar filter list, ad corpus, block-rate test (STREAMING)
- **Scope:** Large
- **Priority:** 4
- **Files to Create:** `src/filters/jio-hotstar.js` (>=30 endpoint patterns incl. `ads.jiohotstar.com`, `cdn-*.hotstar.com/ads`, related domains; DOM selectors), `tests/fixtures/jio-hotstar/endpoints.json` (>=30), `tests/fixtures/jio-hotstar/dom/*.html` (>=20), `tests/unit/jio-hotstar-filter.test.js`, `tests/integration/at2-jio-hotstar-blockrate.test.js`
- **Files to Modify:** `src/utils/filters.js`
- **Dependencies:** T2 (parallel-capable with T3)
- **Satisfies:** AT-2 (>=90%), part of AT-6
- **Test Strategy:** Same as T3 for Hotstar. Include test that `hotstar.com` content CDN paths (non `/ads`) are not blocked.
- **Status:** DONE (102 tests total, corpus rate 91.8%)

### T5: VAST/VPAID detection and blocking
- **Scope:** Medium
- **Priority:** 5
- **Files to Create:** `src/filters/vast-vpaid.js`, `tests/fixtures/vast-vpaid/prime-video/{vast,vpaid}/*.json` (>=10 each), `tests/fixtures/vast-vpaid/jio-hotstar/{vast,vpaid}/*.json` (>=10 each), `tests/unit/vast-vpaid.test.js`, `tests/integration/at3-vast-vpaid.test.js`
- **Files to Modify:** `src/utils/filters.js`
- **Dependencies:** T3, T4
- **Satisfies:** AT-3 (>=90% of wrapper requests per platform), spec 5 requirement "VAST/VPAID wrapper calls blocked"
- **Test Strategy:** Fixture replay per platform asserts >=90% each (4 groups); unit tests on URL param/path signatures (`vast`, `vpaid`, `ad_type`, `.xml` wrapper heuristics) plus negative cases for content manifests.
- **Status:** DONE (136 tests total, 91.7% per group)

### T6: declarativeNetRequest rules generation and service worker (request-level blocking)
- **Scope:** Large
- **Priority:** 6
- **Files to Create:** `scripts/build-rules.js` (converts filter lists to DNR JSON; run via webpack/npm script), `src/rules/streaming-rules.json` (generated, committed), `src/background.js`, `src/utils/rules-loader.js` (validates bundled list, fails safe), `tests/unit/rules-generation.test.js`, `tests/unit/background.test.js`, `tests/integration/dnr-rules-parity.test.js`
- **Files to Modify:** `src/manifest.json` (rule_resources, host permissions), `package.json` (add `build:rules` script), `webpack.config.js`
- **Dependencies:** T3, T4, T5
- **Satisfies:** AT-1/AT-2/AT-3 at the request level in the browser (parity with JS matcher), AT-10 (filter load <200 ms design), AT-17 (service worker half), edge cases: corrupted bundled list, service worker restart, offline
- **Test Strategy:** Parity test: every corpus item blocked by the JS matcher is covered by a generated DNR rule (or documented as DOM-only, count reported); rules count within static-rule limits; background unit tests with mocked chrome (onInstalled init, onStartup, corrupted/missing list disables blocking and sets warning state); load-time timing test (30 cold-start simulations, p95 <200 ms).
- **Status:** DONE (165 tests total, 99.6% stmt coverage)

### T7: Player DOM handling (content script, dynamic injection, playback integrity)
- **Scope:** Large
- **Priority:** 7
- **Files to Create:** `src/content-script.js`, `src/content/player-ads.js` (selectors, safe-removal logic, MutationObserver, never touches controls/subtitles/progress bar), `src/content/platform-detect.js`, `tests/unit/player-ads.test.js`, `tests/integration/at4-playback-integrity.test.js`, `tests/integration/at6-dynamic-injection.test.js`, `tests/harness/mock-player.js` (mocked player with progress bar, subtitles, controls, ad inject/remove for both platforms)
- **Files to Modify:** `src/manifest.json` (content_scripts, `run_at`)
- **Dependencies:** T3, T4 (selectors), T6 (service worker messaging contract defined in T9; this task uses a thin stub interface)
- **Satisfies:** AT-4 (0 blank frames >500 ms, progress within 1 s, subtitles, controls), AT-6 (static plus injected up to 60 s later at AT-1/AT-2 rates), AT-11 (detection latency <100 ms p95 over >=100 injections), AT-9 (content script overhead design)
- **Test Strategy:** Harness-driven: inject ad containers at t=0 and at random times up to 60 s (fake timers), assert removal rate >=90% per platform, assert harness invariants (progress delta <=1 s, subtitle node intact, controls respond, blank-frame duration <=500 ms using the harness's frame model). Latency test over >=100 injections, p95 <100 ms. Unknown/changed DOM test: no crash, no content removed.
- **Status:** NOT STARTED

### T8: Streaming checkpoint (quality gate, no new features)
- **Scope:** Small
- **Priority:** 8
- **Files to Create:** `tests/integration/streaming-gate.test.js` (aggregates AT-1, AT-2, AT-3, AT-4, AT-6 results into one pass/fail summary), `progress/streaming-gate-report.json` (generated output, not committed by hand)
- **Files to Modify:** None
- **Dependencies:** T3, T4, T5, T6, T7
- **Satisfies:** Spec "primary release gate"; blocks all later general-web merges if any streaming rate <90% or playback invariant fails
- **Test Strategy:** Integration: runs the five suites programmatically and asserts each threshold; run again as regression check after T10.
- **Status:** NOT STARTED

### T9: Storage layer (sync whitelist, local stats, quotas, fallbacks)
- **Scope:** Medium
- **Priority:** 9
- **Files to Create:** `src/utils/storage.js`, `tests/unit/storage.test.js`, `tests/integration/storage-quota.test.js`
- **Files to Modify:** `tests/setup.js` (quota-aware storage mock if needed)
- **Dependencies:** T1 (independent of T3 to T8, may be built in parallel with them; placed here to keep streaming first)
- **Satisfies:** AT-14 (settings persistence), AT-13 (whitelist/blacklist persistence part), AT-12, Performance: storage latency <20 ms p95, edge cases: sync quota exceeded (evict stats first, never whitelist), local full (evict oldest stats), read failure falls back to bundled defaults, session-disable cleared on startup
- **Test Strategy:** Unit with mocked chrome.storage for get/set/remove, defaults fallback, error paths; quota test fills sync to 100 KB / 8 KB per item and local to 10 MB and verifies eviction order and graceful error message; timing test over >=100 ops p95 <20 ms. Whitelist sync across two profiles is MANUAL (T17).
- **Status:** NOT STARTED

### T10: Messaging, per-tab stats, whitelist/blacklist enforcement, badge
- **Scope:** Medium
- **Priority:** 10
- **Files to Create:** `src/utils/messaging.js` (message types/contracts), `src/utils/tab-stats.js` (per-tab counts, per-platform label data, blocked-domain list, cleanup on tab close/navigation), `tests/unit/messaging.test.js`, `tests/unit/tab-stats.test.js`, `tests/integration/message-flow.test.js`
- **Files to Modify:** `src/background.js` (wire handlers, badge via `chrome.action.setBadgeText`, apply whitelist via dynamic DNR allow rules, session/permanent disable), `src/content-script.js` (report blocked items; skip all work on whitelisted domain)
- **Dependencies:** T6, T7, T9
- **Satisfies:** AT-13 (blocking disabled on whitelisted domain, blacklisted domain blocked), AT-12 (message passing coverage), spec 2 badge and per-tab isolation, edge cases: whitelisted page does no removal, multiple tabs no leakage, service worker restart no state loss
- **Test Strategy:** Unit for message validation and stat accumulation; integration across content script <-> background <-> mocked storage including two-tab isolation, service worker restart simulation, and whitelisted-domain no-op assertion.
- **Status:** NOT STARTED

### T11: Clean corpus and false-positive suite (streaming-sensitive)
- **Scope:** Medium
- **Priority:** 11
- **Files to Create:** `tests/fixtures/clean/domains.json` (>=1000 legitimate domains/URLs), `tests/fixtures/clean/streaming-dom/*.html` (>=50 fixtures: movie/show content, subtitles, player controls on both platforms), `tests/integration/at8-false-positives.test.js`
- **Files to Modify:** `src/filters/*.js` or `src/content/player-ads.js` only to fix false positives found
- **Dependencies:** T3, T4, T5, T7 (run against streaming lists now; re-run after T12 with banner rules)
- **Satisfies:** AT-8 (<2%, i.e. <20 of 1000, and 0 subtitle/control elements blocked or altered)
- **Test Strategy:** Corpus replay through URL matcher, DNR parity rules and DOM handler; hard assertion of zero subtitle/control elements touched; reports each false positive for triage. Re-run in T12 and T18.
- **Status:** NOT STARTED

### T12: General banner ad blocking (secondary)
- **Scope:** Medium
- **Priority:** 12
- **Files to Create:** `src/filters/general-ads.js` (>=100 general ad domain patterns, CSS patterns `.ad-`, `.advertisement`, `.advert-`, `.banner-ad`, sizes 300x250, 728x90, 970x90), `src/rules/general-rules.json` (generated), `src/content/banner-ads.js`, `tests/fixtures/general/domains.json` (>=100), `tests/fixtures/general/dom/*.html` (>=100), `tests/unit/general-ads.test.js`, `tests/integration/at7-banner-blockrate.test.js`
- **Files to Modify:** `src/content-script.js`, `src/manifest.json` (second ruleset), `scripts/build-rules.js`
- **Dependencies:** T8 (streaming gate green), T10, T11
- **Satisfies:** AT-7 (>=95%), spec precedence rule (re-run AT-1/AT-2/AT-4/AT-8 to prove no regression)
- **Test Strategy:** Corpus replay asserts >=95%; matching must be size-aware (jsdom layout stubs for ad-size detection); regression: re-run `streaming-gate.test.js` and AT-8; disabling general ruleset must not affect streaming rates.
- **Status:** NOT STARTED

### T13: Popup UI
- **Scope:** Large
- **Priority:** 13
- **Files to Create:** `src/popup.html`, `src/popup.js`, `src/styles/popup.css` (light/dark via `prefers-color-scheme`), `tests/integration/popup.test.js`
- **Files to Modify:** `src/manifest.json` (action default_popup, if not already)
- **Dependencies:** T10 (stats/messaging), T9
- **Satisfies:** AT-15 (0, 1, 100+ counts, per-platform label, blocked-domain list, no render errors), AT-13 (whitelist/blacklist toggle writes to storage), spec 2 (settings button opens options, session/permanent disable, non-web tab "Not available on this page", retry once within 1 s when service worker unavailable, corrupted-list warning state)
- **Test Strategy:** jsdom integration: render with 0/1/100+ ads on Prime Video and Jio Hotstar tab fixtures; assert console.error not called; whitelist button writes to mocked sync storage; settings button calls `openOptionsPage`; error state with retry timing via fake timers; CSS test asserts dark and light variables. Popup open/close during playback is covered by a harness test asserting no DOM/progress change in the mock player (real-site check in T17).
- **Status:** NOT STARTED

### T14: Options page
- **Scope:** Large
- **Priority:** 14
- **Files to Create:** `src/options.html`, `src/options.js`, `src/styles/options.css`, `src/utils/import-export.js`, `tests/unit/import-export.test.js`, `tests/integration/options.test.js`
- **Files to Modify:** `src/utils/storage.js` (category toggles: images/scripts/iframes, custom patterns, reset), `src/background.js` (apply category toggles and custom patterns as dynamic DNR rules), `src/manifest.json` (options_page if not already)
- **Dependencies:** T9, T10, T2 (pattern validation)
- **Satisfies:** AT-16 (export then import identical; invalid patterns rejected with message and not saved; reset restores bundled defaults), AT-14 (settings persistence through reload), edge cases: malformed import rejected/skipped with count and existing rules unchanged, match-all pattern rejected, storage quota messaging
- **Test Strategy:** Round-trip equality test (deep-equal rule set), malformed/oversized import fixtures, invalid-pattern table test, reset-to-defaults test, category toggle effect test on generated dynamic rules, persistence test simulating extension reload by re-instantiating modules against the same mock store.
- **Status:** NOT STARTED

### T15: Error handling and edge-case hardening
- **Scope:** Medium
- **Priority:** 15
- **Files to Create:** `tests/integration/edge-cases.test.js`
- **Files to Modify:** `src/background.js`, `src/content-script.js`, `src/content/player-ads.js`, `src/utils/storage.js`, `src/popup.js` (only where tests expose gaps)
- **Dependencies:** T10, T13, T14
- **Satisfies:** Spec Edge Cases table in full (corrupted bundled list, storage failures, service worker restart, unknown DOM, offline, ad-network domain change leaves unknown domains unblocked, element removal that hits a control is a defect), AT-12 branch coverage, AT-17 (0 errors)
- **Test Strategy:** One test per row of the spec edge-case table, asserting the stated expected behavior; no uncaught exceptions or console errors.
- **Status:** NOT STARTED

### T16: Performance benchmarks and CI regression checks
- **Scope:** Medium
- **Priority:** 16
- **Files to Create:** `tests/performance/benchmarks.js` (run by `npm run benchmark`), `tests/performance/perf-thresholds.json`, `tests/performance/perf.test.js`, `.github/workflows/ci.yml` (test, coverage, benchmark, fails on regression), `progress/perf-report.json` (generated)
- **Files to Modify:** `package.json` (scripts, e.g. `test:perf`)
- **Dependencies:** T6, T7, T9, T12
- **Satisfies:** AT-9 (<50 ms overhead p95, synthetic page-load comparison with and without content script over >=50 loads), AT-10 (<200 ms p95 over >=30 cold starts), AT-11 (<100 ms p95 over >=100 injections), storage <20 ms p95 (>=100 ops), spec "regressions fail CI"
- **Test Strategy:** Automated synthetic benchmarks in Node/jsdom with p95 computed and compared with thresholds; the report is saved as JSON. Real-site metrics (50 sessions, service worker memory <=50 MB after 1 h, rebuffer/dropped frames) are MANUAL and recorded in T17.
- **Status:** NOT STARTED

### T17: Manual test protocol and log templates
- **Scope:** Small
- **Priority:** 17
- **Files to Create:** `tests/manual/AT-5-playback-log.md` (template: >=10 titles per platform, >=10 min each, auto-play and manual, pause/resume, subtitles, controls, rebuffer count), `tests/manual/sync-whitelist-log.md` (two-profile sync within 5 min), `tests/manual/real-page-perf-log.md` (50 sessions p95 overhead, dropped frames, 1 h memory)
- **Files to Modify:** None
- **Dependencies:** T13 (popup exists to exercise), T16
- **Satisfies:** AT-5 (MANUAL), manual sync check (Storage and Sync), manual halves of the Performance Targets table, confirmation of corpus endpoints against live captures (planning assumption 4)
- **Test Strategy:** Templates only (no code); the human tester fills them in with their own Prime Video and Jio Hotstar accounts. The Review Agent checks that the logs are completed before sign-off.
- **Status:** NOT STARTED

### T18: Release gates (coverage, manifest validation, clean load, final regression)
- **Scope:** Medium
- **Priority:** 18
- **Files to Create:** `tests/integration/extension-load.test.js` (AT-17 automated parts: manifest validation, all referenced files exist, service worker module imports without error), `scripts/validate-manifest.js`, `README` section on loading the unpacked extension (edit only if allowed by the Build Agent rules)
- **Files to Modify:** `package.json` (script `validate`), `jest.config.js` (confirm 80% gate is enforced; no weakening)
- **Dependencies:** T15, T16, T17
- **Satisfies:** AT-12 (>80% line coverage, reported by the coverage tool), AT-17 (0 errors in service worker and error console, manifest valid for Chrome Web Store; the real Chrome load is a documented manual check), final re-run of AT-1 to AT-16 as the Definition of Done regression
- **Test Strategy:** `npm test -- --coverage` meets thresholds; manifest validator checks required Web Store fields (name, version, description, icons, permissions justification, MV3 CSP); full suite plus benchmark in CI; tick every AT in the SPEC checklist with evidence links.
- **Status:** NOT STARTED

## Dependency Graph
```
T1 scaffold/manifest/test infra
 |
 +--> T2 filter engine core
 |      |
 |      +--> T3 Prime Video  --+
 |      +--> T4 Jio Hotstar  --+--> T5 VAST/VPAID
 |                              |       |
 |                              +-------+--> T6 DNR rules + service worker
 |                              |                 |
 |                  T3,T4 ------+--------------> T7 player DOM handling
 |                                                |
 |      T3,T4,T5,T6,T7 --------------------------> T8 STREAMING GATE
 |
 +--> T9 storage (parallel-capable, after T1)
        |
 T6,T7,T9 --> T10 messaging / per-tab stats / whitelist / badge
 T3,T4,T5,T7 --> T11 clean corpus + false positives
 T8,T10,T11 --> T12 general banner blocking
 T10,T9 --> T13 popup
 T9,T10,T2 --> T14 options page
 T10,T13,T14 --> T15 edge-case hardening
 T6,T7,T9,T12 --> T16 performance + CI
 T13,T16 --> T17 manual protocols
 T15,T16,T17 --> T18 release gates
```
Parallelizable pairs: (T3, T4), (T9 with T3 to T8), (T13, T14).

## AT Coverage Matrix
| AT | Task(s) |
|----|---------|
| AT-1 | T3, T6 (parity), T8 |
| AT-2 | T4, T6 (parity), T8 |
| AT-3 | T5, T8 |
| AT-4 | T7, T8 |
| AT-5 (MANUAL) | T17 |
| AT-6 | T3, T4, T7, T8 |
| AT-7 | T12 |
| AT-8 | T11 (re-run T12, T18) |
| AT-9 | T7 (design), T16 |
| AT-10 | T6, T16 |
| AT-11 | T7, T16 |
| AT-12 | T2, T9, T10, T15, T18 |
| AT-13 | T9, T10, T13 |
| AT-14 | T9, T14 |
| AT-15 | T13 |
| AT-16 | T14 |
| AT-17 | T1, T6, T15, T18 |

## Files to Create (New)
- [ ] src/manifest.json
- [ ] src/background.js
- [ ] src/content-script.js
- [ ] src/popup.html, src/popup.js, src/styles/popup.css
- [ ] src/options.html, src/options.js, src/styles/options.css
- [ ] src/utils/filters.js
- [ ] src/utils/patterns.js
- [ ] src/utils/rules-loader.js
- [ ] src/utils/storage.js
- [ ] src/utils/messaging.js
- [ ] src/utils/tab-stats.js
- [ ] src/utils/import-export.js
- [ ] src/filters/prime-video.js
- [ ] src/filters/jio-hotstar.js
- [ ] src/filters/vast-vpaid.js
- [ ] src/filters/general-ads.js
- [ ] src/content/player-ads.js
- [ ] src/content/platform-detect.js
- [ ] src/content/banner-ads.js
- [ ] src/rules/streaming-rules.json (generated)
- [ ] src/rules/general-rules.json (generated)
- [ ] scripts/build-rules.js
- [ ] scripts/validate-manifest.js
- [ ] webpack.config.js, babel.config.js, .eslintrc.json
- [ ] .github/workflows/ci.yml
- [ ] tests/harness/mock-player.js
- [ ] tests/fixtures/README.md
- [ ] tests/fixtures/prime-video/endpoints.json, tests/fixtures/prime-video/dom/*.html
- [ ] tests/fixtures/jio-hotstar/endpoints.json, tests/fixtures/jio-hotstar/dom/*.html
- [ ] tests/fixtures/vast-vpaid/{prime-video,jio-hotstar}/{vast,vpaid}/*.json
- [ ] tests/fixtures/general/domains.json, tests/fixtures/general/dom/*.html
- [ ] tests/fixtures/clean/domains.json, tests/fixtures/clean/streaming-dom/*.html
- [ ] tests/unit/manifest.test.js
- [ ] tests/unit/filters.test.js
- [ ] tests/unit/patterns.test.js
- [ ] tests/unit/prime-video-filter.test.js
- [ ] tests/unit/jio-hotstar-filter.test.js
- [ ] tests/unit/vast-vpaid.test.js
- [ ] tests/unit/rules-generation.test.js
- [ ] tests/unit/background.test.js
- [ ] tests/unit/player-ads.test.js
- [ ] tests/unit/storage.test.js
- [ ] tests/unit/messaging.test.js
- [ ] tests/unit/tab-stats.test.js
- [ ] tests/unit/general-ads.test.js
- [ ] tests/unit/import-export.test.js
- [ ] tests/integration/at1-prime-video-blockrate.test.js
- [ ] tests/integration/at2-jio-hotstar-blockrate.test.js
- [ ] tests/integration/at3-vast-vpaid.test.js
- [ ] tests/integration/at4-playback-integrity.test.js
- [ ] tests/integration/at6-dynamic-injection.test.js
- [ ] tests/integration/at7-banner-blockrate.test.js
- [ ] tests/integration/at8-false-positives.test.js
- [ ] tests/integration/dnr-rules-parity.test.js
- [ ] tests/integration/streaming-gate.test.js
- [ ] tests/integration/storage-quota.test.js
- [ ] tests/integration/message-flow.test.js
- [ ] tests/integration/popup.test.js
- [ ] tests/integration/options.test.js
- [ ] tests/integration/edge-cases.test.js
- [ ] tests/integration/extension-load.test.js
- [ ] tests/performance/benchmarks.js, perf-thresholds.json, perf.test.js
- [ ] tests/manual/AT-5-playback-log.md, sync-whitelist-log.md, real-page-perf-log.md

## Files to Modify (Existing)
- [ ] tests/setup.js (extra chrome API mocks: action, declarativeNetRequest, storage.onChanged, runtime.openOptionsPage/onStartup/onInstalled, tabs events, webNavigation)
- [ ] package.json (scripts: build:rules, test:perf, validate)
- [ ] jest.config.js (confirm only; thresholds must not be lowered)
- [ ] src/manifest.json (iteratively, T6, T7, T12, T13, T14)
- [ ] src/background.js, src/content-script.js, src/utils/storage.js, src/utils/filters.js (iteratively, as listed per task)

## Risks and Notes for Reviewers
- **MV3 limits (spec assumption):** some ads (server-side stitched, in-manifest) cannot be blocked at request level; DOM action is the fallback and the 90% rate includes them. If the honest corpus rate falls below 90% for a platform, escalate to the human rather than trimming the corpus.
- **Corpus validity:** fixtures are author-generated until confirmed against live traffic (assumption 4); AT-1/AT-2 pass on the corpus does not equal real-world 90%. T17 live-capture confirmation is required before sign-off.
- **Version floor v90:** limits API choices (see assumption 2). Raising the floor to v111 or v102 would simplify counting and session state.
- **Task sizes:** T3, T4, T6, T7, T13, T14 are Large; the Build Agent may split corpus authoring from matcher work if a single session is too big.
- **Commit rule:** per SPEC Notes for Agents, commit after each streaming feature (T3 to T8) is complete.
