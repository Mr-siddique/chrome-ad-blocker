# Code Review Report (re-review after FIX iteration 1)

**Date:** 2026-11-01
**Reviewer:** Review Agent
**Verdict:** APPROVE-WITH-CONDITIONS (beta / unpacked build ceiling). Not a full APPROVE.

Automated state re-run: `npm test` gives 33 suites and 649/649 tests passing. Coverage is 99.87% lines. The performance gates pass (details below). All automatable items PASS. Everything still open is human-only.

## Previous blockers

| # | Previous blocker | Status |
|---|------------------|--------|
| 1 | AT-5 playback test (10+10 titles) | **Still open (human-only).** Not run, and no agent can run it. |
| 2 | AT-17 real Chrome load and Web Store check | **Still open (human-only).** The manifest validator and build pass in jest only. |
| 3 | Live-traffic corpus confirmation | **Still open (human-only).** Corpora are still `confirmed:false`. |
| 4 | Network-level blocks not counted | **Resolved in code; real-Chrome behaviour unverified (human M3).** See below. |
| 5 | Real-page AT-9, memory and rebuffer; flaky synthetic gate | **Flaky gate: partially resolved.** Real-page items still open (human-only). |
| 6 | Two-profile sync and restart persistence | **Still open (human-only).** |
| Defect 2 | VAST/VPAID false positives | **Resolved for the documented class.** Some residual risk remains. |
| Defect 3 | TLD list too narrow | **Partially resolved.** The list grew from 15 to 25 TLDs, but it is still a fixed list. |
| Defect 6 | jsdom not a declared devDependency | **Still open (human-only).** `package-lock.json` is root-owned; this is listed as M7. |
| Defect 5 | Silent custom-pattern cap | **Still open (minor).** It is documented as known and not fixed. |

## Specific checks

**`declarativeNetRequestFeedback` permission: justified and within constraints.**
- It is the only API that exposes `getMatchedRules`. It is needed for the spec section 2 popup, badge and per-platform counts, because most Prime and Hotstar blocking happens at request level.
- `getMatchedRules` returns only which of the extension's own rules matched. It does not return page content.
- It does not change the "no data egress" constraint. `src/` still has no fetch, XHR, WebSocket or beacon calls, and the static check still passes.
- The justification is added to `scripts/validate-manifest.js`.
- It is a second DNR-adjacent permission, so it may get extra Web Store review scrutiny. This is a condition, not a defect.

**Polling is quota-safe and cannot affect playback, with limits.**
- Polling runs entirely in the service worker. It does not touch the page, the player or the content script, so it cannot degrade playback.
- Background polls are capped at 18 calls per 10 minutes (`withinBudget`), below Chrome's documented 20-call limit.
- Popup opens use `force:true` and bypass the budget. The code relies on the activeTab exemption, which is unverified.
- Each navigation spends up to 4 calls (3 timed polls plus one on `complete`). The budget is therefore used up after about 4 or 5 navigations in 10 minutes. After that, background counts go stale until the popup is opened.
- The timers are `setTimeout`. A suspended MV3 worker may drop the 6 s and 15 s polls. Fail-safe behaviour: errors are caught and counts fall back to DOM removals only.
- Not verified: the double-counting case (a request that is blocked and then its placeholder is removed from the DOM). Human item M3.

**The VAST/VPAID fix is a class rule, not an allow-list of the three URLs, but it is a heuristic.**
- The code adds a documentation-shape exemption: `/vast/` at end of URL, `/vast/<docword>`, `/<docword>/vast`, `/<docword>-vast`. There are 14 doc words, and the same patterns apply to vpaid.
- The three known false positives are regression cases, and they are generalised. They are not hard-coded.
- In DNR the exemptions are priority-2 allow rules. Host-specific block rules at higher priority are unaffected. Only the priority-1 VAST heuristic is relaxed.
- Residual risks:
  - The doc-word list could be tuned to the author's fixtures.
  - An ad path such as `/ads/vast/about` would now pass.
  - The `vpaid` substring heuristic is unchanged.
  - Nothing here is validated on real traffic.

**The benchmark fix is genuine but partial.**
- It adds a warmup and takes the median of 5 per-round p95s. The 50 ms threshold is unchanged. The `adSelectorFor` cache in the content script is a real code optimisation, not a gate change.
- It is still a synthetic jsdom measure, not a page-load delta.
- Over 7 runs the result ranged from 31.8 to 44.3 ms. That is a 12 ms spread and a worst case 5.7 ms from the gate. Flake risk is lower but not eliminated.
- Other synthetic performance gates pass: filter-load 1.13 ms, detection 0.24 ms, storage 0.01 ms, url-match 0.004 ms.

## What remains unproven

The 90% goal for Prime Video and Jio Hotstar is not proven.
- The 92.1% (Prime) and 91.8% (Hotstar) figures come from author-written corpora. Their hosts mostly overlap the vendor lists the rules were built from, and they are matched by an author-written DNR simulator, not Chrome's engine.
- Those results show the rules are internally consistent. They do not show real-world block rates. This review does not count them toward the 90% streaming goal.
- Also unproven:
  - Playback integrity (AT-5).
  - Real DOM class names for dynamic injection (AT-6).
  - Server-side ad stitching, which is not blockable at request level.
  - Real-Chrome load (AT-17).
  - Real-page overhead, service worker memory and rebuffer.
  - Profile sync and restart persistence.
- **Only the human can close these**, using live Chrome, real ad-tier accounts and live traffic.

## Conditions for APPROVE-WITH-CONDITIONS (beta only)

1. Ship only as a labelled beta or unpacked build. Do not claim "90% verified" or "AT-1..AT-17 pass".
2. Human completes blockers.md M1 (AT-5, any broken control or subtitle is a fail) and M2 (real Chrome load with zero errors, Web Store manifest check including the new permission justification).
3. Human completes M4: live HAR and DOM captures, set `confirmed:true`, re-run. If either platform is below 90%, expand rules before any public claim.
4. Human completes M3: verify popup, badge and domain counts match reality, check the service worker console for `getMatchedRules` errors, and check for double counting. If counts are stale, consider `chrome.alarms` or a longer budget.
5. Human completes M5 and M6: real-page p95 under 50 ms, service worker memory at most 50 MB, rebuffer comparison, restart persistence and two-profile sync.
6. Human runs `npm install --save-dev jsdom` and commits the lock file (M7).
7. Follow-ups, not blocking beta: a visible message when the 1900-rule cap is hit, and a TLD strategy that is not a fixed list.
