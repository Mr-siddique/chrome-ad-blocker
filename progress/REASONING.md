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
