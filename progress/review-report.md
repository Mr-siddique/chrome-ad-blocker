# Code Review Report

**Date:** 2026-11-01
**Reviewer:** Review Agent
**Verdict:** REJECT (not mergeable as "AT-1..AT-17 pass / DoD met"; engineering quality is good, evidence of the primary goal is missing)

## Summary
The implementation is clean, MV3-compliant, well tested (620/620 tests, 99.9% lines) and honestly self-labelled by Build/Test agents. But the primary goal, blocking >=90% of Prime Video and Jio Hotstar ads without breaking playback, is NOT demonstrated. It is claimed on an author-written, unconfirmed corpus whose hosts come from the same vendor lists as the rules (circular), and on a synthetic jsdom player. SPEC Definition of Done requires AT-5 and real-Chrome AT-17, both NOT RUN. These cannot be satisfied by automation, so the DoD cannot be met without a human.

## Evidence classes
- A = automated test, meaningful on its own (logic, storage, UI, manifest shape)
- B = passes only on author-written corpus / synthetic harness (not real-world evidence)
- C = NOT RUN

## Per-AT table
| AT | Spec requirement | Class | Evidence / reviewer note |
|----|------------------|-------|--------------------------|
| AT-1 | Prime >=90% | B | 92.1% on 59 endpoints + 30 DOM, `confirmed:false`. Corpus hosts ~53/59 vendor-known = same source as the rules. Matching is by DNR-simulator (`tests/harness/dnr-sim.js`), not Chrome's engine. Margin over gate is 2 points. |
| AT-2 | Hotstar >=90% | B | 91.8% on 43 + 30, unconfirmed, same circularity. 2 points of margin. |
| AT-3 | VAST/VPAID >=90% | B | 48 author-written fixtures, 91.7%. Substring `vpaid` and `/vast-`, `/vast1` etc. are broad; real wrappers on Amazon/Hotstar are likely server-side (SSAI) and not request-separable. |
| AT-4 | Playback integrity (mock) | B | Mock-player jsdom only. Protected selectors (`button`, `[class*=control]`, subtitle, progress, seek, volume, `video`) are sensible and conservative. |
| AT-5 | Manual, 10+10 titles | C | Template blank, "NOT RUN". Blocker. |
| AT-6 | Dynamic injection | B | MutationObserver on mock player; class names (`atvwebplayersdk-ad*`, etc.) not confirmed against live DOM. |
| AT-7 | Banner >=95% | B | 97.4% on 119 domains + 108 fixtures, author-built. 2.4 points margin. |
| AT-8 | FP <2%, 0 control/subtitle | B | 3/1414 = 0.21%, but only ~350 of 1414 are real domains; 3 known FPs are real (see below). Streaming DOM FP check on 55 author fixtures only. |
| AT-9 | Overhead <50 ms p95 | B/C | Synthetic jsdom scan time, not page-load delta; 9 runs 34.2-46.3 ms (flaky, 3.7 ms from gate). Real 50-page measurement NOT RUN. |
| AT-10 | Filter load <200 ms | B/C | 1.3 ms synthetic; real SW cold starts NOT RUN (likely fine). |
| AT-11 | Detection <100 ms | B | 0.22 ms in mock harness. |
| AT-12 | Coverage >80% | A | 99.86% lines, min file 98.87%. Valid, but high coverage does not validate real-site behaviour. |
| AT-13 | Whitelist/blacklist | A (mocked chrome) | Message-flow + popup integration against chrome mocks. Plausible. |
| AT-14 | Persistence | A/C | Simulated reload only; browser-profile restart NOT RUN. |
| AT-15 | Popup rendering | A/B | Passes, but see blocker 4: count reflects only DOM removals. |
| AT-16 | Options page | A | Import/export round trip, invalid pattern rejection, reset; rollback logic is good. |
| AT-17 | Loads cleanly | A (partial)/C | Manifest validator OK, build tested in jest. Real Chrome load, SW/extension error console, Web Store validation NOT RUN. |
| Other | Sync across profiles, SW memory <=50 MB, rebuffer/dropped frames, live traffic confirmation | C | All NOT RUN. |

## Code review findings
Good:
- Manifest is valid MV3. Permissions are minimal (`storage`, `declarativeNetRequest`, `activeTab`), CSP is `script-src 'self'`, no remote code. `src/` itself is not loadable (ES-module imports with no `"type":"module"`); the webpack `dist/` build is required, which README documents. Static check asserts no fetch/XHR/WebSocket/beacon/eval/`new Function` under `src/`; I found none. No egress, no analytics, privacy requirement met.
- DNR: 123 streaming + 129 general static rules, unique ids, no regex rules, no `main_frame` in resourceTypes (page navigations cannot be blocked), well below static limits. Allow rules for subtitles (priority 4) and manifests/segments (priority 2) protect content; host blocks outrank player allows.
- Content script is conservative about controls and subtitles and wraps the observer in try/catch. Storage has chunked sync, quota handling, fallbacks and a corrupted-list fail-safe.

Defects / risks:
1. **Request-level blocks are never counted.** Nothing uses `declarativeNetRequestFeedback` / `onRuleMatchedDebug` / `getMatchedRules`. Badge, popup count, per-platform label and blocked-domain list reflect only DOM element removals. Since most Prime/Hotstar blocking is at request level, the popup will show 0 for most real blocks. This conflicts with spec section 2 and means AT-15 passes against synthetic DOM removals only.
2. **VAST/VPAID heuristics produce false positives.** `iab.com/guidelines/vast/`, `blog.example.com/what-is-vpaid`, `docs.example.org/vast/overview` are flagged by the JS matcher. In DNR, `main_frame` is excluded so navigation is not broken, but sub-resources whose URLs contain `vpaid` anywhere or `/vast-`, `/vast1`, `/vast_` are blocked at priority 1 on every site, including movie-title or content paths (e.g. `/vast-...`). Low severity but unverified outside author fixtures.
3. **TLD expansion is a fixed list of 15 TLDs**; wildcard hosts on other TLDs (e.g. `.ae`, `.sg`) will not be blocked. Acceptable for MVP but undermines real-world coverage claims.
4. **Content script on `<all_urls>`, `all_frames`, `document_start`** with a MutationObserver on attributes (src/class/id) for all pages and a broad CANDIDATES selector (`[data-testid]`, `img`, `script[src]`): real overhead on heavy pages is unknown; jsdom benchmark is only a proxy and is flaky.
5. **Custom pattern cap of 1900 dynamic rules is silent** (no visible limit message); minor.
6. `jsdom` is not a declared devDependency (benchmark relies on a transitive copy); `package-lock.json` not writable. Process issue.
7. Corpus self-describes as unconfirmed and no live capture was done; class names/endpoints may not match current Prime/Hotstar. Ads with server-side stitching (common on both platforms) are by design unblockable at request level and the DOM fallback was only tested on mocks.

## Is the 90% goal demonstrated?
No. It is claimed, not demonstrated. The 92.1% / 91.8% figures are measured by the author's own simulator against author-curated lists drawn from the same vendor sources as the rules, with unlisted hosts deliberately added to sit just above 90%. They show the rules are internally consistent and that matching logic works on novel subpaths/subdomains; they say nothing about live Prime Video or Hotstar traffic or DOM, nor playback safety. The reviewer rubric ("do not trust passing tests; verify they test the right thing") is not satisfied by circular corpora alone.

## Blockers
1. AT-5 not run (10+10 titles, 10 minutes each, auto/manual play, subtitles, controls, rebuffer). Required by DoD.
2. AT-17 not verified in real Chrome (load `dist/`, SW and extension error console empty, Web Store validation).
3. Corpora not confirmed with live traffic captures (the spec assumption explicitly requires it); real block rate unmeasured. The tester's AT-5 template has a real block-rate table to fill.
4. Popup/badge/domain list do not count network-level blocks (defect 1). Either add `declarativeNetRequestFeedback` + `getMatchedRules`/debug listener (note: permission affects store review) or change spec/UI and document that only DOM removals are counted.
5. Real-page AT-9 (p95 overhead on 50 streaming + 50 regular pages) and SW memory/rebuffer/dropped-frame checks NOT RUN; the synthetic overhead gate is flaky.
6. Two-profile sync, profile-restart persistence NOT RUN.

## Recommended next steps
1. Human runs `npm run build`, loads `dist/` in Chrome, confirms 0 errors (AT-17), runs the Chrome Web Store manifest check.
2. Human with ad-tier Prime Video and Hotstar accounts captures live ad traffic and DOM (HAR + DOM snapshots), replaces the unconfirmed corpus (set `confirmed:true`), and re-runs AT-1/2/3/6. If real rates fall below 90%, expand rules or DOM selectors before shipping.
3. Complete AT-5 log (10 titles per platform), real-page perf log, sync log.
4. Fix popup counting for request-level blocks; add tests with a Chrome-like DNR feedback mock.
5. Tighten VAST heuristics (`vpaid` substring, `/vast-`), widen or switch TLD handling, add an informational-page FP test.
6. Run `npm install --save-dev jsdom` and relax or median-ize the jsdom overhead gate to avoid CI flakes.

## Conditional path
If the human accepts shipping as an unpacked or beta build with the stated caveat, this could be treated as APPROVE-WITH-CONDITIONS (conditions = blockers 1-3 and 4), but the spec's DoD and the reviewer rubric do not permit full APPROVE today. Final verdict: **REJECT** until AT-5, real-Chrome AT-17, and live-corpus confirmation are done.
