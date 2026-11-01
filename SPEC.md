# SPEC STATUS: FINALIZED

# Chrome Ad Blocker Extension - Feature Specification

## Overview
A privacy-first Chrome (Manifest V3) extension that blocks advertisements on web pages using pattern matching and content detection. The extension makes no network calls of its own and collects no user data.

**PRIMARY FOCUS:** Block video streaming ads on Prime Video and Jio Hotstar during movie/show playback (pre-roll, mid-roll, bumpers, player overlays). All streaming requirements take priority over general web ad requirements wherever they conflict.

## Terminology
- **Streaming ad:** A video ad (pre-roll, mid-roll, bumper) or player overlay/banner ad shown inside the Prime Video or Jio Hotstar player.
- **General banner ad:** A non-video ad on any other web page (CSS-pattern, ad-size, or known ad-domain based).
- **Blocked:** The ad request is cancelled, or the ad element is removed or hidden, so the ad does not render or play to the user.
- **False positive:** A legitimate resource or element (movie/show content, subtitles, player controls, non-ad page content) that the extension blocks or alters.
- **Ad corpus:** The fixed, versioned set of ad samples used to measure block rate (see Acceptance Tests). The corpus is committed to the repo so results are reproducible.
- **Clean corpus:** The fixed, versioned set of non-ad samples used to measure false positives.

## Conflict Resolution (Block-Rate Targets)
The 90% and 95% targets apply to different ad categories and do not conflict:
- Streaming ads (Prime Video, Jio Hotstar): block rate >=90% per platform. Streaming ads use dynamic and server-side delivery, so a lower target than general banners is accepted. This is the primary release gate.
- General banner ads (non-video): block rate >=95%.
- The single "Block accuracy >=95%" row in earlier drafts is replaced by the two category-specific targets above.
- Precedence: if a change raises the general banner block rate but lowers a streaming block rate below 90% or breaks playback, the change is rejected.
- False-positive limit (<2%) applies to both categories (see below).

## Acceptance Tests (Testable Criteria)
Each test must be runnable by the Test Agent as an automated test, except where marked MANUAL.

### Priority: Streaming Ads
- [ ] **AT-1 Prime Video block rate >=90%**
  - How to test: Replay the Prime Video ad corpus (>=50 distinct ad endpoints/requests plus >=20 recorded ad-injection DOM fixtures covering pre-roll, mid-roll, bumper) through the blocker.
  - Pass if: >=90% of corpus items are blocked.
- [ ] **AT-2 Jio Hotstar block rate >=90%**
  - How to test: Replay the Jio Hotstar ad corpus (>=30 distinct ad endpoints/requests plus >=20 recorded ad-injection DOM fixtures covering pre-roll, mid-roll, bumper) through the blocker.
  - Pass if: >=90% of corpus items are blocked.
- [ ] **AT-3 VAST/VPAID blocking**
  - How to test: Feed >=10 VAST and >=10 VPAID wrapper request fixtures per platform.
  - Pass if: >=90% of wrapper requests are blocked.
- [ ] **AT-4 Playback integrity (automated)**
  - How to test: Run a mocked player harness with ad injection and removal for both platforms.
  - Pass if: after ad removal, 0 black/blank frames are caused by the extension for more than 500 ms, the progress bar value differs by <=1 second from expected content position, subtitles render, and play/pause/seek/volume controls respond.
- [ ] **AT-5 Playback integrity (MANUAL, real sites)**
  - How to test: Play >=10 titles on Prime Video and >=10 titles on Jio Hotstar, each for >=10 minutes, with both auto-play and manual play, including pause/resume.
  - Pass if: for every title, 0 playback failures, subtitles work, controls work, and rebuffer events caused by the extension total 0. Recorded in a test log.
- [ ] **AT-6 Dynamic injection**
  - How to test: Inject ad containers into the player DOM after page load (static ads present at load and ads injected up to 60 s later).
  - Pass if: both static and dynamically injected ad containers are blocked at the AT-1/AT-2 rates.

### General Ads
- [ ] **AT-7 Banner block rate >=95%**
  - How to test: Run the filter against a corpus of >=100 general ad domains and >=100 banner DOM fixtures (CSS patterns `.ad-`, `.advertisement`, `.advert-`, `.banner-ad`; sizes 300x250, 728x90, 970x90).
  - Pass if: >=95% of corpus items are blocked.

### Accuracy / False Positives
- [ ] **AT-8 False positive rate <2%**
  - How to test: Run the filter against a clean corpus of >=1000 legitimate domains/URLs plus >=50 clean DOM fixtures from streaming pages (movie/show content, subtitles, player controls).
  - Pass if: fewer than 2% of clean-corpus items are blocked or altered (<20 of 1000 domains), and 0 subtitle or player-control elements are blocked.

### Performance
- [ ] **AT-9 Content script overhead <50 ms** (see Performance Targets)
- [ ] **AT-10 Filter load time <200 ms** (see Performance Targets)
- [ ] **AT-11 Video ad detection latency <100 ms** (see Performance Targets)

### Quality
- [ ] **AT-12 Test coverage >80%** line coverage across all critical functions (filter matching, storage, message passing, ad detection), as reported by the coverage tool. Target set by Test Agent notes is >85%; the release gate is >80%.

### User Interface and Settings
- [ ] **AT-13 Whitelist/blacklist via popup**
  - How to test: Integration test adds and removes the current domain via the popup.
  - Pass if: the entry is saved to storage, blocking is disabled for a whitelisted domain on next page load, and a blacklisted domain is blocked.
- [ ] **AT-14 Settings persistence**
  - How to test: Change settings, reload the extension, and restart the browser profile.
  - Pass if: all settings equal their pre-reload values.
- [ ] **AT-15 Popup rendering**
  - How to test: Render the popup with 0, 1, and 100+ blocked ads.
  - Pass if: the correct count is shown, per-platform label (e.g., "Blocked 3 Prime Video ads") is shown, the blocked-domain list is shown, and no render errors are logged.
- [ ] **AT-16 Options page**
  - How to test: Integration tests for import/export, custom patterns, per-domain whitelist, category toggles, reset.
  - Pass if: export followed by import yields an identical rule set; invalid patterns are rejected with an error message and not saved; reset restores the bundled defaults.
- [ ] **AT-17 Extension loads cleanly**
  - Pass if: the extension loads in Chrome with 0 errors in the service worker and extension error console, and manifest.json passes Chrome Web Store validation.

## Performance Targets (Measured)
| Metric | Target | How to Measure |
|--------|--------|----------------|
| Streaming ad block rate (per platform) | >=90% | AT-1, AT-2 corpus replay; blocked items / total items |
| General banner ad block rate | >=95% | AT-7 corpus replay; blocked items / total items |
| False positive rate | <2% of clean-corpus items; 0 subtitle/control elements | AT-8 clean corpus |
| Content script overhead per page load | <50 ms at the 95th percentile | Compare page load time with and without the extension over >=50 loads each on streaming pages (Prime Video, Jio Hotstar) and >=50 regular pages; report p95 difference |
| Streaming ad detection latency | <100 ms at the 95th percentile | Time from ad element/request appearing to being blocked, measured in the mocked player harness over >=100 injections |
| Filter load on startup | <200 ms at the 95th percentile | Time from service worker start to filter ready, over >=30 cold starts |
| Playback impact | 0 extension-caused rebuffer events; dropped frames increase <=1 percentage point vs. extension disabled | Compare playback on >=10 titles per platform with and without the extension |
| Service worker memory | <=50 MB resident after 1 hour of idle plus playback | Chrome task manager / DevTools memory snapshot |
| Storage access latency | <20 ms at the 95th percentile for read or write of settings | Timed calls over >=100 operations |
| Test coverage | >80% line coverage | Coverage tool report in CI |

Performance regression tests run on every deploy and results are reported in CI. A regression beyond a target fails the CI run.

## Detailed Requirements

### 1. Core Ad Detection
**Story:** As a user, I want streaming video ads (Prime Video, Jio Hotstar) blocked automatically with no setup.

**Primary targets (streaming):**
- Prime Video ad servers, including `aiv-cdn.amazon.com/ads` and `ad-tier-*.prd.primevideo.*`, and Prime Video embedded ad networks.
- Jio Hotstar ad servers, including `ads.jiohotstar.com` and `cdn-*.hotstar.com/ads`, and related ad domains.
- VAST and VPAID ad protocol requests.
- Video player overlays and banner ads on these two platforms.

**Secondary targets (general web):**
- Banner ads matching class patterns `.ad-`, `.advertisement`, `.advert-`, `.banner-ad`.
- Ad containers sized 300x250, 728x90, 970x90.
- Known ad domains such as doubleclick.net and googlesyndication.com.

**Behavior requirements:**
- The extension must detect ads delivered via known ad domains, via ad container elements injected into the player, and via VAST/VPAID requests.
- The extension must block ad requests before the ad renders or plays, wherever Chrome MV3 allows it; where it cannot, it must remove or hide the ad element.
- Ad blocking must be enabled by default with no user setup.

**Test coverage:**
- Unit tests for Prime Video ad domain detection (>=50 known endpoints) and Jio Hotstar (>=30 known endpoints).
- Mock DOM tests for video player ad injection.
- False-positive tests on movie/show content, player controls, subtitles (AT-8).

### 2. User Interface (Popup)
**Story:** As a user, I want to see which streaming ads were blocked and manage blocking quickly.

**UI components (all required):**
- Count of blocked ads on the current page.
- Platform-specific label (e.g., "Blocked 3 Prime Video ads").
- List of blocked ad domains/networks for the current page.
- Toggle to whitelist the current domain.
- Toggle to disable blocking for the current session or permanently.
- Settings button that opens the options page.
- Badge on the extension icon showing the blocked count for the current tab.
- Dark and light theme, following the browser/OS color-scheme setting.

**Test coverage (AT-15 plus):**
- Whitelist button writes to storage.
- Settings button opens the options page.
- Popup open/close during playback causes 0 playback interruptions and 0 extension-caused dropped frames beyond the Playback impact target.
- Popup displays correctly on Prime Video and Jio Hotstar tabs.

### 3. Options Page
**Story:** As a user, I want control over blocking rules.

**Features (all required):**
- Import and export the block list.
- Add custom filter patterns.
- Manage the per-domain whitelist.
- Enable or disable blocking by category: images, scripts, iframes.
- Reset to defaults.

**Test coverage (AT-14, AT-16):** settings persist after refresh; import/export round trip is identical; invalid patterns are rejected with a message.

### 4. Storage and Sync
**Story:** Blocking rules persist across sessions and devices.

**Requirements:**
- The whitelist is stored in `chrome.storage.sync`.
- Statistics (block counts) are stored in `chrome.storage.local`.
- A default filter list is bundled with the extension.
- Periodic blocklist updates from a remote source are out of scope for the MVP (see Out of Scope).

**Test coverage:**
- Settings survive extension reload (AT-14).
- Storage usage stays within Chrome quotas (sync: 100 KB total and 8 KB per item; local: 10 MB), verified by a test that fills storage to the limit.
- Whitelist sync across two profiles signed in to the same account: MANUAL test; the entry appears on the second profile within 5 minutes of Chrome sync.

### 5. Streaming Video Ad Blocking (Critical for MVP)
**Story:** As a user watching on Prime Video or Jio Hotstar, I want ads blocked without disrupting playback.

**Requirements (each verified by AT-1 to AT-6):**
- Prime Video ad requests are blocked before an ad is inserted into the player.
- Jio Hotstar ad containers injected into the player are removed.
- VAST/VPAID wrapper calls that trigger video ads are blocked.
- The progress bar position stays accurate (within 1 second of expected content position).
- Subtitles continue to display and sync.
- No black or blank screen lasting more than 500 ms is caused by ad removal.
- Both static ads and dynamically injected ads are handled.
- Pause and resume work normally.

**Test coverage:** 10+ titles per platform, auto-play and manual play (AT-5); coverage of control/subtitle preservation (AT-4, AT-8).

### 6. Performance Profiling
**Story:** The extension must not degrade streaming or browser performance.

**Requirements:**
- Metrics listed in the Performance Targets table are measured on 50 real Prime Video/Jio Hotstar playback sessions and 50 regular web pages.
- Benchmarks run on every deploy and are reported in CI.

## In Scope (MVP Priority: Streaming)
- Detect and block Prime Video ad networks.
- Detect and block Jio Hotstar ad networks.
- VAST/VPAID ad protocol detection and blocking.
- Player overlay ad removal (pre-roll, mid-roll, bumpers).
- Subtitle and player control preservation.
- General banner ad blocking (secondary).

## Out of Scope (Future)
- Other streaming platforms (Netflix, Disney+, YouTube Premium). YouTube ad stripping on the free tier is in scope under Amendment A1 only.
- AI-based content classification.
- Advanced domain reputation system.
- Cross-browser support (Chrome only for MVP).
- Audio/podcast ad detection.
- Periodic remote blocklist updates.

## Edge Cases and Error Handling
| Scenario | Expected Behavior |
|----------|------------------|
| Bundled filter file missing or corrupted | Extension disables blocking, shows a warning in the popup and badge, logs an error; does not crash or block unrelated content |
| Imported block list is malformed or contains invalid patterns | Import is rejected (or invalid entries skipped with a count shown), existing rules remain unchanged |
| Custom pattern would match everything (e.g., `*`) | Pattern is rejected with an error message |
| `chrome.storage.sync` quota exceeded | Write fails gracefully with a visible message; existing whitelist is kept; statistics are evicted first, never the whitelist |
| `chrome.storage.local` full | Oldest statistics are evicted; whitelist and settings are kept |
| Storage read fails or returns empty | Extension falls back to bundled defaults |
| Service worker terminated and restarted mid-session | Blocking resumes within the filter load target (<200 ms) with no state loss for persisted settings |
| Page is whitelisted | No blocking or element removal occurs on that domain |
| Blocking disabled for session | Blocking is re-enabled when the browser session ends; "permanently" persists until user re-enables |
| Ad delivered with a stream that cannot be separated at request level (server-side stitched video) | Counted in the corpus; the 90% target applies. Ads not blockable are not claimed as blocked |
| Ad container removal removes a player control, subtitle, or content element | Treated as a defect (false positive); AT-4 and AT-8 fail |
| Player DOM changes structure (platform update) | Previously unmatched ads continue to play; playback is not broken. No crash occurs on an unknown DOM |
| Ad network domain changes | Falls under the bundled list; unknown domains are not blocked until the list is updated in a new extension release |
| Popup opened on a non-web tab (chrome://, new tab) | Popup shows "Not available on this page" and disables toggles; no error |
| Multiple tabs on streaming sites | Counts and blocked lists are tracked per tab with no cross-tab leakage |
| Service worker is unavailable when popup opens | Popup shows an error state and retries once within 1 second |
| Chrome offline | Blocking continues using bundled rules |

## Constraints and Assumptions
**Technical**
- Chrome Manifest V3 only; service worker, no background page.
- Minimum supported Chrome version: v111 (raised from v90 by Amendment A1; required for content scripts with `"world": "MAIN"`).
- No external runtime dependencies; extension is functional offline.
- The extension makes no network requests of its own.

**User / Environment**
- Users run a modern desktop Chrome (v111+).
- Users are signed in to Chrome for sync features to work.
- Tests of real platforms require valid Prime Video and Jio Hotstar accounts supplied by the tester.

**Data / Privacy / Legal**
- No user tracking, no analytics, and no browsing data leaves the device; GDPR compliant by design.
- Statistics are stored locally only.
- Ad corpora contain only ad endpoints and DOM fixtures, no user data or copyrighted content.

**Assumptions**
- The bundled default filter list contains >=80 Prime Video and Jio Hotstar ad patterns (50 + 30 per the unit-test minimums) and >=100 general ad patterns.
- Prime Video and Jio Hotstar ad endpoints named in this spec are representative and will be confirmed against live traffic captures by the Build and Test agents.
- Chrome's MV3 network-blocking limits (rule count, no blocking webRequest) apply; some ads may only be removable via DOM actions.

## Testing Strategy
- **Unit:** each filter and storage function individually.
- **Integration:** popup, background service worker, and content script message flow.
- **E2E:** real websites in an isolated Chrome profile (AT-5).
- **Performance:** benchmarks per the Performance Targets table, with regression checks in CI.

## Definition of Done
- [ ] All acceptance tests AT-1 to AT-17 pass.
- [ ] Test coverage >80%.
- [ ] Code review approved.
- [ ] All Performance Targets met and reported in CI.
- [ ] Extension loads with 0 errors.
- [ ] manifest.json valid for Chrome Web Store.

## Notes for Agents
1. **Plan Agent:** Break work into independent, testable tasks. Schedule streaming ad detection first, video player DOM handling as a separate task, and general banner blocking after.
2. **Build Agent:** Create filter lists for Prime Video and Jio Hotstar first, general ads second. Create files as needed. Commit after each streaming feature is complete.
3. **Test Agent:** Implement AT-1 to AT-17 as automated tests (AT-5 and the sync check are manual with a written log). Target >85% coverage; release gate is >80%. Profile on real streaming pages.
4. **Review Agent:** Compare each feature against this spec and block if unmet. Verify the 90% streaming block rate for both platforms, the performance targets on streaming pages, and absence of false positives affecting content, subtitles, or controls.

---

## AMENDMENT A1: YouTube as a third platform (human-approved scope change, 2026-11-01)
Status of the rest of this spec is unchanged (FINALIZED). This amendment adds YouTube and raises `minimum_chrome_version` from 90 to 111.

**Why different:** YouTube in-stream ads are first-party. They are served from `googlevideo.com` and described inside the player response JSON (`ytInitialPlayerResponse`, `/youtubei/v1/player`, `/youtubei/v1/next`) under `adPlacements`, `playerAds`, `adSlots` and similar fields. Network (DNR) rules cannot separate them from content, so blocking is done by (1) a MAIN-world document_start script that strips those fields from parsed player responses, and (2) an isolated-world DOM fallback that skips or fast-forwards an ad that still plays and hides ad containers with CSS.

**Target status (honest):** NO numeric block-rate target (and specifically not 90%) is claimed for YouTube. It is best-effort, first-party, and cannot be verified by automated tests because YouTube's payloads and player DOM change without notice. Verification is MANUAL; results are recorded in `tests/manual/youtube-log.md`. Automated tests cover only the logic against fixtures that mimic known response shapes.

- [ ] **AT-18 Ad fields stripped from player responses (automated, fixture-based)**
  - How to test: Feed realistic player-response fixtures (initial `ytInitialPlayerResponse`, `/youtubei/v1/player`, `/youtubei/v1/next`, via the `window` setter trap, `JSON.parse`, and `Response.json()/text()`) through the MAIN-world logic.
  - Pass if: `adPlacements`, `playerAds`, `adSlots` and ad-break fields are absent from the result; all other fields (`videoDetails`, `streamingData`, `captions`, `playabilityStatus`, `responseContext`) are deeply unchanged; non-YouTube-shaped objects and non-matching URLs are returned untouched; no exception reaches the caller on malformed input.
- [ ] **AT-19 Skip / fast-forward fallback (automated, jsdom fixtures)**
  - How to test: DOM fixtures with `.ad-showing` on `.html5-video-player`, with and without a skip button.
  - Pass if: a present skip button is clicked; otherwise the video is muted, `currentTime` is set to a finite duration and `playbackRate` raised (max 16) only while the ad shows, and the original mute/rate are restored afterwards; with no ad, nothing is touched.
- [ ] **AT-20 No breakage of playback, controls, subtitles, live streams (automated + MANUAL)**
  - Pass if (automated): the fallback never modifies controls (`.ytp-chrome-bottom`, `.ytp-subtitles-button`, captions window) and never seeks or changes rate/mute when no ad is showing, including when duration is `Infinity` or `NaN` (live). MANUAL: confirmed on real YouTube for pre-roll, mid-roll, skippable, unskippable, live stream, Shorts, captions and controls, logged in `tests/manual/youtube-log.md`.
- [ ] **AT-21 No new network egress (automated)**
  - Pass if: the YouTube code makes no `fetch`/XHR/beacon calls of its own and adds no host permissions beyond content-script match patterns; the manifest permission list is unchanged.

**Platform plumbing:** blocks are reported with platform id `youtube` and displayed as "Blocked N YouTube ads" in the popup and counted in the badge.

**Known limits:** server-side ad insertion (SSAI) and any ad delivered in a response shape we do not strip cannot be removed by field stripping and fall to the fallback. YouTube may detect and degrade playback for blockers (e.g. enforcement overlays); this is outside this extension's control.
