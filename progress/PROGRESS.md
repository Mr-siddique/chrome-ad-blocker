# Development Progress Tracker

**Last Updated:** 2026-11-01
**Phase:** TEST (Test Agent)

## Completed Tasks
- [x] T1: Project scaffolding, manifest, test infrastructure - MV3 manifest, webpack/babel/eslint config, richer chrome mocks, fixtures README (8 tests)
- [x] T2: Filter engine core (matcher, pattern parsing, validation) - host-indexed URL/element matcher, pattern validation (60 tests total, 98% coverage)
- [x] T3: Prime Video filter list, ad corpus, block-rate test (STREAMING, FIRST) - Prime Video list (55 rules), 59 endpoint + 30 DOM fixture corpus (unconfirmed), AT-1 test (82 tests total, corpus rate 92.1%)
- [x] T4: Jio Hotstar filter list, ad corpus, block-rate test (STREAMING) - Jio Hotstar list (40 rules), 43 endpoint + 30 DOM fixture corpus (unconfirmed), AT-2 test (102 tests total, corpus rate 91.8%)
- [x] T5: VAST/VPAID detection and blocking - VAST/VPAID signatures, 48 wrapper fixtures, AT-3 test (136 tests total, 91.7% per group)
- [x] T6: declarativeNetRequest rules generation and service worker (request-level blocking) - DNR rule generation (85 rules), service worker with fail-safe init, parity tests (165 tests total, 99.6% stmt coverage)
- [x] T7: Player DOM handling (content script, dynamic injection, playback integrity) - content script, player DOM ad removal with protected controls/subtitles, mock player harness, AT-4/AT-6/AT-11 tests (227 tests total)
- [x] T8: Streaming checkpoint (quality gate, no new features) - streaming gate aggregating AT-1/2/3/4/6 (PASS) (235 tests total)
- [x] T9: Storage layer (sync whitelist, local stats, quotas, fallbacks) - chunked sync whitelist/blacklist, settings, session flag, per-day local stats, quota handling (272 tests total, storage.js 98.7% stmts)
- [x] T10: Messaging, per-tab stats, whitelist/blacklist enforcement, badge - typed messaging, per-tab stats + badge, whitelist/blacklist DNR enforcement, session/permanent disable (323 tests total)
- [x] T11: Clean corpus and false-positive suite (streaming-sensitive) - 1414-URL clean corpus + 55 clean streaming DOM fixtures; AT-8 test; fixed 2 DNR over-matches it found (388 tests total, 0.21% FP)
- [x] T12: General banner ad blocking (secondary) - general banner ads: 114-host list, general DNR ruleset, banner context, AT-7 corpora; streaming gate re-run PASS (486 tests total, AT-7 97.4%)
- [x] T13: Popup UI - popup UI (counts, platform labels, domain list, whitelist/session/permanent toggles, settings, warning/error states, light/dark CSS) (510 tests total)
- [x] T14: Options page - options page (categories, custom patterns, whitelist, import/export with rollback, reset), dynamic rules from storage changes (558 tests total)
- [x] T15: Error handling and edge-case hardening - one test per spec edge-case row; hardening of corrupted-list DOM path, unhandled rejections, observer exceptions (586 tests total)
- [x] T16: Performance benchmarks and CI regression checks - synthetic p95 benchmarks (AT-9/10/11, storage), thresholds file, perf test, CI workflow (592 tests total, all p95 under targets)
- [x] T17: Manual test protocol and log templates - blank manual protocol templates (AT-5 + live capture confirmation, whitelist sync, real-page perf); NOT RUN (templates only; 592 tests total)
- [x] T18: Release gates (coverage, manifest validation, clean load, final regression) - release gates: manifest validator, build and load tests, icons, README load instructions, AT status table (620 tests total, ~99% line coverage)

## Remaining Tasks

## Blocked Items
See progress/blockers.md (if present).

## Notes
- Corpora are author-generated and marked confirmed:false; see tests/fixtures/README.md.
- AT-5 and other MANUAL tests have NOT been run.


## Acceptance test status (evidence is automated unless noted)
"Automated pass" means the test passes on the author-built, UNCONFIRMED corpus or the synthetic harness. It is not evidence of the real-world rate. Nothing manual has been run.

| AT | Status | Evidence |
|----|--------|----------|
| AT-1 Prime Video >=90% | Automated pass (corpus 92.1%) | tests/integration/at1-prime-video-blockrate.test.js |
| AT-2 Jio Hotstar >=90% | Automated pass (corpus 91.8%) | tests/integration/at2-jio-hotstar-blockrate.test.js |
| AT-3 VAST/VPAID >=90% | Automated pass (91.7% per group, synthetic fixtures) | tests/integration/at3-vast-vpaid.test.js |
| AT-4 Playback integrity (mock) | Automated pass on mock player | tests/integration/at4-playback-integrity.test.js |
| AT-5 Playback integrity (real sites) | NOT RUN (manual) | tests/manual/AT-5-playback-log.md |
| AT-6 Dynamic injection | Automated pass on mock player | tests/integration/at6-dynamic-injection.test.js |
| AT-7 Banner >=95% | Automated pass (corpus 97.4%) | tests/integration/at7-banner-blockrate.test.js |
| AT-8 False positives <2% | Automated pass (3/1414 = 0.21%, 0 subtitle/control altered) | tests/integration/at8-false-positives.test.js |
| AT-9 Content script <50 ms | Automated pass (synthetic jsdom ~33-39 ms p95); real pages NOT RUN | tests/performance, tests/manual/real-page-perf-log.md |
| AT-10 Filter load <200 ms | Automated pass (synthetic ~1 ms p95); real cold starts NOT RUN | tests/performance |
| AT-11 Detection <100 ms | Automated pass (synthetic ~0.2 ms p95); real pages NOT RUN | tests/performance, at6 |
| AT-12 Coverage >80% | Pass (see npm test coverage table, ~99% lines) | jest coverage |
| AT-13 Whitelist/blacklist | Automated pass | message-flow, popup tests |
| AT-14 Settings persistence | Automated pass (simulated reload); browser-restart check NOT RUN | options.test.js, storage tests |
| AT-15 Popup rendering | Automated pass | tests/integration/popup.test.js |
| AT-16 Options page | Automated pass | tests/integration/options.test.js |
| AT-17 Loads cleanly | Manifest, build output and module loading automated; real Chrome load NOT RUN (manual) | tests/integration/extension-load.test.js, README |

Other unverified items: corpus endpoints and player DOM class names are not confirmed against live traffic; two-profile whitelist sync, service worker memory, rebuffer/dropped-frame impact are NOT RUN.


## Test Agent verification (2026-11-01)
Status: PASS for all automatable items (see progress/test-results.json). Manual/real-Chrome items are NOT RUN.
- npm test: 32 suites, 620/620 passed. Coverage 99.86% lines, 99.46% stmts, 96.17% branches; lowest file 98.87% lines (gate 80%).
- Benchmarks (synthetic jsdom): filter load 1.3 ms, detection 0.22 ms, storage 0.009 ms, match 0.004 ms, all well under target.
- Content-script overhead p95 over 9 independent runs: 34.2-46.3 ms (target 50). FLAKE RISK: one run reached 46.3 ms.
- AT-8: the 3 false positives are real (VAST/VPAID heuristics on iab.com/guidelines/vast/, /what-is-vpaid, /vast/overview). 0.21% is under the 2% limit, with 0 subtitle/control altered.
- NOT RUN: AT-5, real-Chrome AT-17, real-page AT-9/10, profile restart (AT-14), two-profile sync, SW memory, playback impact, live corpus confirmation.
- Blocker: jsdom missing from devDependencies (root-owned lock file); needs `npm install --save-dev jsdom` by a human.


## FIX iteration 1 (Build Agent, 2026-11-01)
- DONE: network-level (DNR) blocks now counted in badge/popup/per-platform labels via getMatchedRules + declarativeNetRequestFeedback (best-effort, polled; see REASONING.md). Not verified in real Chrome (blockers.md M3).
- DONE: 3 known VAST/VPAID false positives fixed and kept as permanent `known-fp-regression` corpus cases; clean corpus now flags 0. Real wrapper blocking unchanged (tests).
- DONE: overhead benchmark stabilised (warmup + 5 rounds, median of p95s; 50 ms threshold unchanged). Median ~34 ms.
- DONE: TLD expansion widened from 15 to 25 TLDs.
- OPEN (human): AT-5, real Chrome load, live corpus, real-page perf/memory, sync, jsdom devDependency. See progress/blockers.md.
- npm test: 32+1 suites, all pass, coverage ~99.4% stmts (gate 80).
