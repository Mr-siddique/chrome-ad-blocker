# Agent Reasoning & Decision Log

**Purpose:** Agents document WHY they made decisions, so they can learn from mistakes and improve future decisions.

**Updated by:** All agents during development  
**Read by:** Review Agent (validates decisions), other agents (learn from past)

---

## Decision Logging Format

When an agent makes a significant decision, it documents:

```markdown
### [Decision Title]
**Agent:** [Agent name]  
**Phase:** [SPEC/PLAN/BUILD/TEST/REVIEW]  
**Task:** [Task name if applicable]  
**Date:** [YYYY-MM-DD HH:MM]  

**Decision:** What was decided?

**Reasoning:** Why was this decision made?

**Assumptions:** What was assumed to be true?

**Alternatives Considered:** What other options were there?

**Risk Level:** LOW/MEDIUM/HIGH

**Outcome:** [After execution] Was it right?

**Learnings:** [If failed] What to do differently next time?
```

---

## Spec Phase Reasoning

### Decision: Focus on Prime Video & Jio Hotstar
**Agent:** Spec Agent  
**Phase:** SPECIFY  
**Date:** 2024-01-15  

**Decision:** Made streaming video ads (Prime Video & Jio Hotstar) the PRIMARY focus, not a secondary feature.

**Reasoning:** 
- User explicitly requested focus on Prime Video and Jio Hotstar ads during movie playback
- These are challenging ad types (video overlays, VAST/VPAID protocols)
- Blocking streaming ads is high-value for user experience
- Web banner ads are secondary concern

**Assumptions:**
- Prime Video uses consistent ad server endpoints (aiv-cdn.amazon.com, etc.)
- Jio Hotstar uses consistent ad server endpoints (ads.jiohotstar.com, etc.)
- VAST/VPAID protocols follow standards that can be detected

**Alternatives Considered:**
1. Treat streaming ads same priority as web ads → Rejected (user priorities)
2. Try to block ALL ad types equally → Rejected (streaming is harder, needs focus)

**Risk Level:** LOW

**Outcome:** ✅ Spec refined successfully with streaming focus

**Learnings:** None yet (first decision)

---

## Planning Phase Reasoning

*[Populated during PLAN phase by Plan Agent]*

---

## Build Phase Reasoning

*[Populated during BUILD phase by Build Agent]*

### Example Template (For Future Reference)

```
### Decision: [Decision name]
**Agent:** Build Agent
**Phase:** BUILD
**Task:** [Task name]
**Date:** [YYYY-MM-DD HH:MM]

**Decision:** [What was decided?]

**Reasoning:**
- [Why this approach?]
- [What makes it better than alternatives?]

**Assumptions:**
- [What must be true for this to work?]

**Alternatives Considered:**
1. [Alt 1 + why rejected]
2. [Alt 2 + why rejected]

**Risk Level:** [LOW/MEDIUM/HIGH]

**Outcome:** [Will fill after execution]
- [Did it work as expected?]
- [Were there unexpected issues?]

**Learnings:** [Will fill if failed]
- [What went wrong?]
- [What to try differently next time?]
```

---

## Test Phase Reasoning

*[Populated during TEST phase by Test Agent]*

---

## Review Phase Reasoning

*[Populated during REVIEW phase by Review Agent]*

### Example: Review Agent Validation Log

```
### Decision: Accept/Reject filters.js implementation
**Agent:** Review Agent
**Phase:** REVIEW
**Date:** [YYYY-MM-DD HH:MM]

**Decision:** [APPROVED / REJECTED]

**Criteria Checked:**
- Prime Video block rate ≥90%? [✅/❌]
- Jio Hotstar block rate ≥90%? [✅/❌]
- False positives <2%? [✅/❌]
- Code coverage >80%? [✅/❌]

**Issues Found (if rejected):**
1. [Issue 1 + how to fix]
2. [Issue 2 + how to fix]

**Learnings for Build Agent:**
- [If issue was code-related: what pattern caused it?]
- [If issue was design-related: what assumption was wrong?]
```

---

## Mistake Backtracking Examples

### Scenario 1: Test Failure - False Positives Too High

```
### Mistake: filters.js blocking movie titles as ads
**Agent:** Build Agent  
**Phase:** BUILD  
**Task:** Prime Video Ad Filter (Task 1)  
**Date:** 2024-01-16 14:30  

**What Happened:**
- Built filter using simple pattern: /ad|banner|commercial/i
- Test Agent ran tests: 15% false positive rate (FAILED, target <2%)
- Review Agent found: Blocking movie titles like "Ads Manager" or "Advertisement Masterclass"

**Original Decision:**
```javascript
// ❌ BAD - Too broad
const AD_PATTERNS = [/ad|banner|commercial/i];
```

**Why It Failed:**
- Assumption was wrong: Regex word boundaries not considered
- "advertisement" substring matched legitimate content
- No testing against movie/show titles first

**Backtracking Reasoning:**
- ❌ Don't: Use broad substring matching for ad detection
- ✅ Do: Use word boundaries and domain-based detection instead
- ✅ Do: Test against 1000+ legitimate movie/show titles before committing
- ✅ Do: Check CSS classes and DOM structure first, regex patterns second

**Fixed Decision:**
```javascript
// ✅ GOOD - Domain-based + word boundary
const PRIME_VIDEO_DOMAINS = [
  'aiv-cdn.amazon.com',
  'ad-tier-*.prd.primevideo.com',
];

const AD_PATTERNS = [
  /\b(advertisement|ad-container|banner-ad)\b/i,  // Word boundaries
  /advertisement/i,  // Verified safe in context
];
```

**Lessons Learned:**
1. **Test against legitimate content first** before testing ad detection
2. **Domain-based detection is safer** than pattern-based
3. **False positives are worse** than false negatives (users notice blocks)
4. **Start specific, then generalize** (opposite of typical approach)

---

### Scenario 2: Performance Regression - Filter Too Slow

```
### Mistake: Filter matching exceeds 50ms target
**Agent:** Build Agent  
**Phase:** BUILD  
**Task:** Jio Hotstar Ad Filter (Task 2)  
**Date:** 2024-01-16 15:45  

**What Happened:**
- Built filter with 200+ regex patterns
- Test Agent benchmark: 127ms filter matching time (FAILED, target <10ms)
- Review Agent: Performance targets not met

**Original Decision:**
```javascript
// ❌ BAD - Too many patterns, checked in loop
const AD_PATTERNS = [/pattern1/i, /pattern2/i, ..., /pattern200/i];

function detectAd(el) {
  for (let pattern of AD_PATTERNS) {
    if (pattern.test(el.className + el.id + el.src)) {  // ← Slow!
      return true;
    }
  }
}
```

**Why It Failed:**
- Assumption was wrong: Couldn't fit 200 patterns in <10ms
- Regex compilation cost for each check was high
- No benchmarking before committing

**Backtracking Reasoning:**
- ❌ Don't: Use large regex pattern lists
- ✅ Do: Compile patterns once, reuse
- ✅ Do: Use Set lookups for domains (O(1) vs O(n))
- ✅ Do: Benchmark BEFORE committing, not after

**Fixed Decision:**
```javascript
// ✅ GOOD - Compiled patterns + domain Set
const DOMAIN_BLOCKLIST = new Set([
  'aiv-cdn.amazon.com',
  'ads.jiohotstar.com',
  // ... 20 domains instead of 200 patterns
]);

const PATTERN_CACHE = {
  primeVideo: /aiv-cdn\.amazon\.com|primevideo.*ad/i,
  jioHotstar: /jiohotstar|hotstar.*ad/i,
};

function detectAd(el) {
  // Fast: domain lookup first (O(1))
  if (DOMAIN_BLOCKLIST.has(el.domain)) return true;
  
  // Then: pattern matching (only if domain miss)
  return Object.values(PATTERN_CACHE).some(p => p.test(el.src));
}
```

**Lessons Learned:**
1. **Benchmark early, optimize before commit**
2. **Domain blocklists scale better** than pattern lists
3. **Premature optimization is bad, but no optimization is worse**
4. **Profile real pages**, not just test data

---

### Scenario 3: Review Rejection - Missing Acceptance Criteria

```
### Mistake: Implemented feature but forgot to test it
**Agent:** Build Agent  
**Phase:** BUILD → TEST → REVIEW (REJECTED)  
**Task:** Popup UI (Task 4)  
**Date:** 2024-01-17 10:00  

**What Happened:**
- Build Agent created popup.html/js with block count display
- Test Agent ran tests: popup.test.js passed
- Review Agent checked SPEC acceptance criteria
- Found: Test coverage is 85% ✅ but NO TEST for whitelist button functionality
- Review rejected: "Acceptance criteria 'User can whitelist' not tested"

**Original Decision:**
- Built whitelist button UI
- Added unit test for storage.js (whitelist save)
- Assumed popup integration test covers the button

**Why It Failed:**
- Assumption was wrong: Unit test ≠ integration test
- Didn't verify EVERY acceptance criterion had a test
- Skipped the popup button click test

**Backtracking Reasoning:**
- ❌ Don't: Assume unit tests cover integration
- ✅ Do: Read SPEC acceptance criteria line by line
- ✅ Do: Create test for EACH criterion
- ✅ Do: Review checklist before committing

**Fixed Decision:**
```javascript
// Added missing integration test
describe('Popup whitelist button', () => {
  it('saves domain to whitelist when clicked', async () => {
    // 1. Setup
    const testDomain = 'example.com';
    
    // 2. Click whitelist button
    const btn = popup.querySelector('#whitelist-btn');
    btn.click();
    
    // 3. Verify saved
    const whitelist = await getWhitelist();
    expect(whitelist).toContain(testDomain);
    
    // 4. Verify persists
    const stored = await chrome.storage.sync.get('whitelist');
    expect(stored.whitelist).toContain(testDomain);
  });
});
```

**Lessons Learned:**
1. **Match tests to SPEC criteria 1:1**
2. **Integration tests are required**, not optional
3. **Checklist before commit** (acceptance criteria ✅, tests ✅, etc.)
4. **Review Agent will catch these**, but better to prevent

---

## Learning Patterns (Agents: Study These!)

### ❌ Common Mistakes

| Mistake | Why It Fails | How to Prevent |
|---------|------------|----------------|
| Broad regex patterns | Match legitimate content (false positives) | Test against 1000+ legit titles first |
| Too many patterns | Slow performance | Use domain lists + compiled patterns |
| No integration tests | Unit tests pass, but feature broken | Test each SPEC acceptance criterion |
| Premature optimization | Waste time on non-critical path | Benchmark first, optimize second |
| Missing test coverage | Code seems to work, has edge cases | Aim for >85% coverage |

### ✅ Best Practices

| Practice | Why It Works | When to Use |
|----------|------------|-----------|
| Domain blocklists | Fast (O(1)), accurate, maintainable | Ad detection |
| Compiled regex | One-time cost, reuse multiple times | Pattern matching |
| Test-first coding | Tests force clear thinking | Complex logic |
| Benchmark before commit | Prevents performance surprises | Performance-critical code |
| Spec-driven testing | Every feature tested against spec | All features |

---

## Current Agent Learnings

### Build Agent Should Know:
1. **Streaming ads are hard** - Use domain detection first, patterns second
2. **False positives are worse** than false negatives (users notice blocks)
3. **Benchmark early** - Don't wait for Review phase to find slow code
4. **Test integration** - Unit tests aren't enough
5. **Read SPEC line by line** when done - Verify every criterion has a test

### Test Agent Should Know:
1. **Check for integration tests**, not just unit tests
2. **Profile real pages** (Prime Video, Jio Hotstar), not mock data
3. **Coverage >85% is target**, including edge cases
4. **Benchmark against targets** (not just "it's fast")
5. **Report blockers clearly** - Help Build Agent debug

### Review Agent Should Know:
1. **SPEC is law** - Every feature must map to a criterion
2. **Check acceptance criteria 1:1** - One test per criterion
3. **Domain detection is safer** - Prefer it over regex
4. **False positives kill trust** - <2% is critical
5. **Performance matters** - <50ms on real pages, not mocks

---

## Iterative Learning

Each time an agent fails:
1. **Document the mistake** here (format above)
2. **Explain why it failed** (wrong assumption? design flaw? oversight?)
3. **Log the fix** (what changed? why is it better?)
4. **Extract lesson** (what to do/avoid next time?)

When agents see past mistakes logged here, they can avoid repeating them.

---

## Feedback Loop for Agents

**When Review Agent rejects:**
1. Add entry to REASONING.md explaining what went wrong
2. Explain fix strategy
3. Extract lessons for future tasks
4. Build Agent uses this learning for next attempt

**When Test Agent finds bugs:**
1. Log to REASONING.md
2. Explain root cause
3. Provide fix guidance to Build Agent
4. Track pattern (e.g., "regex too broad" appears 3x → systematic issue)

---

## Decision Framework Template

For agents to use before making big decisions:

```markdown
### [Decision Name]
**Agent:** [Your name]  
**Risk Level:** [LOW/MEDIUM/HIGH]  

**Question:** What are we deciding?

**Options:**
1. [Option A] - Pros: [+] Cons: [-]
2. [Option B] - Pros: [+] Cons: [-]
3. [Option C] - Pros: [+] Cons: [-]

**Recommendation:** [Pick one]

**Reasoning:**
- [Why this is best option?]
- [What could go wrong?]
- [How to verify it's right?]

**Checkpoint:** [How to validate this decision in next phase?]
- Benchmark if performance-critical
- Test if correctness-critical
- Code review if architecture-critical
```

---

## How Humans Use This File

1. **Monitor agent decisions** - See what agents are thinking
2. **Identify patterns** - If same mistake appears 3x, need to fix design
3. **Understand blockers** - Why did Review Agent reject?
4. **Extract best practices** - What patterns worked well?

---

## How Agents Use This File

1. **Before deciding** - Check if similar decision was made before
2. **After failure** - Document why, extract lessons
3. **Before next task** - Read learnings from similar task type
4. **During code review** - Use past mistakes as checklist

---

**Remember:** This file is your collective memory. The more you log and learn, the better future decisions will be! 🧠

---
## Build Agent decisions

### T1: Scaffolding decisions
**Agent:** Build Agent | **Task:** T1 | **Risk:** LOW
- Removed the `jest` key from package.json: Jest refuses to run with both it and jest.config.js present (both existed, `npm test` crashed). jest.config.js kept as the single source (thresholds unchanged).
- Added `src/package.json` (`{"type":"module"}`, extra file): lets Node scripts (scripts/build-rules.js, CJS) `import()` the ES-module filter lists while jest/webpack still handle them normally.
- Single content script on `<all_urls>` (all_frames, document_start) instead of separate per-host entries: platform detection happens inside the script, avoiding double injection. Plan mentioned per-host matches plus a general one; this is a minor deviation.
- Permissions: `storage`, `declarativeNetRequest`, `activeTab`. No host_permissions (DNR block rules do not need them). Rule ruleset entries are added in T6/T12.
- webpack `devtool: false`: default dev devtool uses eval, which MV3 CSP forbids. A small inline plugin copies static files (no new dependency).
- tests/setup.js mocks support callback and promise styles and keep an in-memory store with onChanged.
- ESLint enforces max 30 lines per function in src (tests exempt).

### T2: Matcher design
**Agent:** Build Agent | **Task:** T2 | **Risk:** LOW
- Rules are `{id, host, path?, contains?, heuristic?}`. Non-wildcard hosts go into a Map and are looked up by walking host suffixes (O(labels)); wildcard hosts use anchored regexes. `*` in a host is one label; a trailing `.*` is a TLD (com, de, co.uk) so `primevideo.com.evil` cannot match.
- Subtitles are never blocked. Manifests/segments are protected only from `heuristic` rules, so an explicit ad-host rule can still block an ad manifest (needed for the 90% target).
- Size matching applies only to iframe/ins elements (+-2px) to limit false positives on legitimate 300x250 images.

### T3/T4: Streaming corpora are author-generated (HONESTY NOTE)
**Agent:** Build Agent | **Task:** T3, T4 | **Risk:** MEDIUM
- Only `aiv-cdn.amazon.com/ads`, `ad-tier-*.prd.primevideo.*` (Prime Video) and `ads.jiohotstar.com`, `cdn-*.hotstar.com/ads` (Jio Hotstar) come from SPEC.md; they are `confidence: "spec"` and unverified against live traffic.
- Other entries are real, well-known ad-tech domains (doubleclick.net, moatads.com, fwmrm.net, ...) marked `vendor-known`: whether the platform actually requests them is NOT verified. Nothing is claimed to be a confirmed Prime Video / Jio Hotstar ad host. Indian ad-tech entries on the Hotstar list (inmobi, vserv, affle, colombiaonline, tyroo) are likewise vendor-known only.
- Player DOM class names (e.g. `atvwebplayersdk-adtimeindicator*`, `ad-overlay`) are unverified guesses and will not match a live player until confirmed.
- Corpus URLs and DOM fixtures were generated from the same lists they test, so matched items are matched by construction. The only honest "misses" are deliberately included: server-side stitched segment URLs / DOM (video marked as the ad but untouchable), and ad domains not in the list / unknown DOM structure. This ~7% unblockable share is the author's assumption, not a measurement. The AT-1/AT-2 pass proves the machinery, not the real-world 90%. T17 live-capture confirmation is still required.
- Corpus assembly: endpoints + DOM fixtures are combined for the 90% check, and each half is also asserted >=90% individually. Fixtures are marked with `data-corpus-ad`; a fixture counts as blocked only if every marked element is detected and no unmarked element (video, controls, subtitles) is flagged.

### T5: VAST/VPAID signatures
**Agent:** Build Agent | **Task:** T5 | **Risk:** LOW
- Signatures pair a strict JS regex (token boundaries) with a substring `urlFilter` for DNR; DNR is therefore a superset. Manifests/segments/subtitles are protected from these heuristics in JS; in DNR the same protection is done with higher-priority allow rules (T6).
- src/utils/filters.js was NOT modified: vast-vpaid.js imports from it, so combining them there would create an import cycle. Combination happens in rules-loader (T6).
- Fixtures: 12 per group (4 groups), each group has 1 deliberate unblockable wrapper on an unlisted domain with no signature (11/12 = 91.7%). Synthetic URLs, confirmed:false.

### T6: DNR generation and service worker
**Agent:** Build Agent | **Task:** T6 | **Risk:** MEDIUM
- Extra file: `src/utils/dnr-rules.js` (rule converter). Jest cannot run `import()` of ESM from a CJS script, so the converter lives in an ES module that both scripts/build-rules.js and the tests import. The committed `src/rules/streaming-rules.json` is checked against freshly generated output in tests (stale file fails CI).
- Priorities: heuristic VAST/VPAID blocks (1) < allow manifests/segments (2) < host blocks (3) < allow subtitles (4). This mirrors the JS guard: ad-host manifests are blocked, heuristic matches on content manifests are not, subtitles are never blocked.
- Block rules exclude `main_frame` so navigation is never blocked. No `requestDomains`/`initiatorDomains` (Chrome 101) used, to respect the v90 floor, so streaming rules apply on all sites (ad-tech domains are blocked everywhere).
- `urlFilter` for wildcard hosts is a superset of the JS regex (`*` crosses dots). The parity test only demands DNR coverage of every JS-blocked URL (met: 55/55 and 40/40) and that sample content URLs stay unblocked.
- Extra test helper: `tests/harness/dnr-sim.js`, a minimal urlFilter interpreter (not Chrome's engine; real behaviour needs the manual load check in T18/T17).
- Corrupted/missing list: `loadBundledFilters()` returns ok:false, background disables the `streaming` ruleset, sets a "!" badge and persists a `health` record. The popup warning is T13.
- Service worker re-runs `initialize()` at every wake because a terminated worker restarts without onStartup.
- Fixed in tests/setup.js: jsdom lacks setImmediate, flushPromises uses setTimeout.

### T7: Player DOM handling
**Agent:** Build Agent | **Task:** T7 | **Risk:** MEDIUM
- Protection model: content `<video>`, buttons/inputs, sliders, progress, aria-live, and subtitle/caption/control/progress/seek/volume classes are never removed; a container that wraps a content video, slider, or subtitle is also skipped. A `<video>` is removable only if it is itself identified as an ad (ad src or ad class).
- Detection uses candidate selectors (cheap `querySelectorAll`) then `matchElement`; no full-tree walks. MutationObserver watches added nodes and attribute changes (`src`, `class`, `id`, `data-ad-type`).
- Added: `tests/unit/content-script.test.js` (platform detect + content script start; not in PLAN), `getPlatformContext` registry lives in platform-detect.js instead of filters.js (avoids import cycles).
- tests/harness/corpus.js `scanFixture` now uses the real `findAdElements`, so AT-1/AT-2 exercise production detection (rates unchanged: 92.1% / 91.8%).
- AT-4/AT-6/AT-11 are on a synthetic mock player. AT-11 latency (p95 ~2 ms) measures MutationObserver-to-removal in jsdom, not a real browser. AT-9 content-script overhead design: one observer, targeted queries; measured in T16 synthetically. None of this replaces AT-5 (manual, NOT run).
- Server-side stitched ads (same `<video>`) are untouchable by design; the content video is protected.
- Content script still reports via a stub `AD_BLOCKED` message; T10 replaces it with the typed messaging module.

### T8: Streaming gate
**Agent:** Build Agent | **Task:** T8 | **Risk:** LOW
- The gate spawns a child `jest` (coverage off, explicit suite paths, so it cannot recurse) for AT-1/2/3/4/6 and also recomputes per-platform corpus rates. It writes `progress/streaming-gate-report.json`, which is gitignored (generated; also perf-report.json). Re-run after T12 as the regression check.

### T9: Storage layer
**Agent:** Build Agent | **Task:** T9 | **Risk:** MEDIUM
- Whitelist/blacklist are sharded into <=6000-byte chunks (`whitelist.n`, `whitelist.0..`) because sync allows only 8 KB per item; writes are a single atomic `set` then stale chunks are removed, so a quota failure leaves the old list intact.
- Semantics chosen for AT-13: blacklist forces blocking (even when blocking is globally/session disabled); whitelist disables blocking on the domain and its subdomains; a domain is in at most one list; otherwise global `enabled` and the session flag decide.
- Session disable lives in `storage.local` (`chrome.storage.session` is v102+, floor is v90); clearing on `runtime.onStartup` is wired in T10.
- Stats are per-day buckets in `storage.local` (`statsDaily`, max 90 days). On local quota errors the oldest half is evicted. On sync quota errors stats are evicted first (per the spec edge-case row), the write is retried once, and then a visible message is returned; the whitelist is never evicted. Note that evicting local stats does not actually free sync space; the behavior follows the spec wording.
- tests/setup.js now enforces Chrome's sync (100 KB / 8 KB per item / 512 items) and local (10 MB) quotas. `HEALTH_KEY` moved into storage.js; rules-loader re-exports it.
- Custom patterns and import/export persistence arrive in T14.

### T10: Messaging, per-tab stats, whitelist enforcement
**Agent:** Build Agent | **Task:** T10 | **Risk:** MEDIUM
- Added `src/utils/dynamic-rules.js` (not in PLAN): builds dynamic DNR rules from storage. Whitelist => `allowAllRequests` (priority 10, main_frame+sub_frame of the domain, so the whole page is exempt); blacklist => dynamic `block` rules for requests to that domain (priority 5, never main_frame). Id ranges: whitelist 1-900, blacklist 1000-1900, custom 2000+, category 4000+ (T14). `allowAllRequests` is Chrome 84+; I did not use `requestDomains` (101+).
- No `webNavigation`/`tabs` permission: top-frame navigation is signalled by the content script's `PAGE_START` message (sender.tab.id is available without permissions), which resets that tab's count and badge. `tabs.onRemoved` drops closed tabs. Per-tab stats are persisted to storage.local (`tabStats`) so a restarted worker keeps counts; cleared on browser startup.
- Content script asks the background `GET_BLOCKING_STATE` for the TOP page hostname (ancestorOrigins in frames) before observing. If the background is unreachable it keeps blocking. `start()` is now async. Disable/whitelist therefore takes effect on next page load, as AT-13 specifies.
- Blocking-state switch (`applyBlockingState`) enables/disables the `streaming` static ruleset from settings, session flag and health. Static ruleset state is only re-applied on install/startup and on user changes, not on every worker wake.
- Counting: DOM removals reported by the content script. Request-level blocks (static DNR) are not counted (no getMatchedRules at v90) - the badge count underestimates real blocking.
- Handler errors return `{ok:false,error}` instead of throwing; malformed messages are rejected by `validateMessage`.
