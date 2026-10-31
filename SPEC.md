# Chrome Ad Blocker Extension - Feature Specification

## Overview
Build a lightweight, privacy-first Chrome extension that blocks advertisements on web pages using pattern matching and content detection.

**PRIMARY FOCUS:** Block video streaming ads on Prime Video and Jio Hotstar during movie playback, with emphasis on mid-roll and pre-roll ad networks used by these platforms.

## Success Criteria (Acceptance Tests)
- [ ] **PRIORITY:** Blocks ≥90% of Prime Video streaming ads (mid-roll, pre-roll, bumpers)
- [ ] **PRIORITY:** Blocks ≥90% of Jio Hotstar streaming ads (mid-roll, pre-roll, bumpers)
- [ ] Extension blocks ≥95% of common banner ads (non-video)
- [ ] False positive rate <2% (blocking legitimate content, movie/show content unaffected)
- [ ] Content script adds <50ms overhead per page load (minimal movie playback lag)
- [ ] Filter loading takes <200ms on startup
- [ ] Test coverage >80% for all critical functions
- [ ] User can whitelist/blacklist domains via popup UI
- [ ] Settings persist across browser sessions
- [ ] Ad detection doesn't interfere with video player controls or subtitles

## Performance Targets
| Metric | Target | Reasoning |
|--------|--------|-----------|
| Block accuracy | ≥95% | Core functionality |
| False positives | <2% | User experience |
| Page load impact | <50ms | Must not slow browsing |
| Filter startup | <200ms | Fast extension init |
| Test coverage | >80% | Refactoring safety |

## Detailed Requirements

### 1. Core Ad Detection
**Story:** As a user, I want video streaming ads (Prime Video, Jio Hotstar) blocked automatically without any setup.

**PRIMARY TARGETS - Streaming Video Ad Networks:**
- Prime Video ad servers: `aiv-cdn.amazon.com/ads`, `ad-tier-*.prd.primevideo.*`, Prime Video embedded ad networks
- Jio Hotstar ad servers: `ads.jiohotstar.com`, `cdn-*.hotstar.com/ads`, ad-related domains
- Common SVOD ad frameworks: VAST/VPAID protocol detections
- Video player overlays and banner ads on these platforms

**SECONDARY - General Web Ads:**
- Banner ads by CSS patterns: `.ad-`, `.advertisement`, `.advert-`, `.banner-ad`
- Ad container sizes: 300x250, 728x90, 970x90
- General ad domains: doubleclick.net, googlesyndication.com, etc.

**Implementation Details:**
- **Video ad detection:** Monitor video player elements (`<video>`, media containers) for ad networks injecting content
- **DOM pattern matching:** Detect streaming-specific ad containers and overlays
- **Domain blocklisting:** Regex patterns for known Prime Video and Jio Hotstar ad servers
- **Network request interception:** Block requests to identified ad CDNs where feasible
- **CSS class/ID patterns:** Detect ad-related divs injected during video playback
- Block in service worker before content script runs where possible

**Test Coverage:**
- Unit tests for Prime Video ad domain detection (50+ known ad endpoints)
- Unit tests for Jio Hotstar ad domain detection (30+ known ad endpoints)
- Mock DOM elements for video player ad injection
- Test against real streaming ad networks in isolation
- Test false positives on movie/show content, player controls, subtitles

### 2. User Interface (Popup)
**Story:** As a user, I want to see which streaming ads were blocked while watching Prime Video or Jio Hotstar, and easily manage blocking rules.

**UI Components:**
- Show count of blocked video ads on current page
- Show platform-specific info (e.g., "Blocked 3 Prime Video ads")
- List of blocked ad domains/networks
- Toggle to whitelist current domain
- Quick toggle to disable blocking (for this session or permanently)
- Settings button to open options page
- Show notification badges when ads are blocked during video playback
- Dark/light mode support (no distraction during movie viewing)

**Test Coverage:**
- Popup renders correctly with 0 and 100+ blocked ads
- Whitelist button saves to storage
- Settings button navigates to options
- Popup doesn't lag or flash during video playback
- Displays correctly on Prime Video and Jio Hotstar pages

### 3. Options Page
**Story:** As a user, I want granular control over blocking rules.

**Features:**
- Import/export block list
- Add custom filter patterns
- Per-domain whitelist management
- Enable/disable blocking by category (images, scripts, iframes)
- Reset to defaults button

**Test Coverage:**
- Settings persist after refresh
- Import/export round-trip works
- Invalid patterns rejected gracefully

### 4. Storage & Sync
**Story:** Blocking rules should persist.

**Implementation:**
- Store whitelist in chrome.storage.sync
- Store statistics (blocks count) in chrome.storage.local
- Default filter list bundled in manifest
- Periodic updates from blocklist (optional future work)

**Test Coverage:**
- Settings survive extension reload
- Storage quota not exceeded
- Sync works across devices

### 5. Streaming Video Ad Blocking (Critical for MVP)
**Story:** As a user watching movies on Prime Video or Jio Hotstar, I want ads completely blocked without disrupting playback.

**Specific Requirements:**
- Detect Prime Video ad server requests BEFORE they inject into the video player
- Detect Jio Hotstar ad injections and remove ad containers
- Block VAST/VPAID wrapper calls that trigger video ads
- Preserve video player timeline/progress bar accuracy
- Preserve subtitle functionality
- Prevent blank/black screens during ad removal
- Handle both static and dynamically injected ads
- Work with video player pause/resume

**Test Coverage:**
- Test on Prime Video with 10+ movies (various ad scenarios)
- Test on Jio Hotstar with 10+ shows (various ad scenarios)
- Verify movie content, subtitles, and controls work after ad blocking
- Profile video playback smoothness (no stuttering/buffering)
- Test with auto-play and manual play scenarios

### 6. Performance Profiling
**Story:** Extension must not degrade video streaming or browser performance.

**Metrics to Track:**
- Content script execution time on video pages (<50ms impact)
- Video player ad detection time (<100ms)
- Memory usage by background service worker
- Storage access latency
- Video playback buffering/lag introduced by extension

**Benchmarks:**
- Profile against 50 real Prime Video/Jio Hotstar streams
- Profile against 50 regular web pages (no false positives)
- Regression test every deploy
- Report in CI

## In Scope - Streaming-Specific (MVP Priority)
- Detect and block Prime Video ad networks (aiv-cdn.amazon.com, primevideo CDNs)
- Detect and block Jio Hotstar ad networks (ads.jiohotstar.com, cdn.hotstar domains)
- VAST/VPAID video ad protocol detection and blocking
- Video player overlay ad removal (pre-roll, mid-roll, bumpers)
- Subtitle and player control preservation (no false positives)

## Out of Scope (Future)
- Other streaming platforms (Netflix, Disney+, YouTube Premium)
- AI-based content classification (too expensive)
- Advanced domain reputation system
- Cross-browser support (Chrome only for MVP)
- Audio/podcast ad detection

## Testing Strategy
- **Unit:** Test each filter, storage function individually
- **Integration:** Test popup ↔ background ↔ content script flow
- **E2E:** Test on real websites in isolated environment
- **Performance:** Benchmark with Scalene, regression test

## Definition of Done
- [ ] All acceptance tests pass
- [ ] Test coverage >80%
- [ ] Code review approved
- [ ] Performance targets met
- [ ] Extension loads without errors
- [ ] Manifest.json valid for Chrome Web Store

## Assumptions
- Chrome MV3 APIs (no background pages, service workers only)
- No external dependencies (privacy-first, offline-capable)
- Users have modern Chrome version (v90+)

## Notes for Agents
1. **Spec Agent:** 
   - Clarify any ambiguities before Plan Agent runs
   - Emphasize that streaming video ad blocking (Prime Video, Jio Hotstar) is PRIORITY #1
   - Quantify test targets: 90% block rate for streaming ads

2. **Plan Agent:** 
   - Break into independent, testable tasks
   - Prioritize streaming ad detection filters first
   - Plan for video player DOM inspection as a separate task
   - Ensure tests can run against real streaming platforms

3. **Build Agent:** 
   - Create comprehensive filter lists for Prime Video and Jio Hotstar ad networks
   - Create new files as needed; don't try to guess all files upfront
   - Focus on streaming-specific detection patterns first, general ads second
   - Commit after each streaming feature is complete

4. **Test Agent:** 
   - Aim for >85% coverage, not just 80%
   - Specifically test Prime Video and Jio Hotstar ad networks
   - Test that legitimate video content, subtitles, and controls are NOT blocked
   - Profile performance on actual streaming pages (not just test pages)

5. **Review Agent:** 
   - Compare every feature against this spec; block if unmet
   - **CRITICAL:** Verify that streaming ad block rates (90%+) are met for both platforms
   - Verify performance targets on streaming video pages specifically
   - Ensure no false positives that affect movie/show content or player functionality
