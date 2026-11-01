# Manual Check: Whitelist Sync Across Two Chrome Profiles

**STATUS: NOT RUN.** Blank template. Source: SPEC section 4 (Storage and Sync). Cannot be automated: it needs two real Chrome
profiles signed in to the same Google account with Chrome sync enabled.

## Pass criteria
A whitelist entry added on profile A appears on profile B within 5 minutes of Chrome sync, and removal also propagates.

## Setup
- Tester: ____________  Date: ____________
- Chrome version A: ______  Chrome version B: ______
- Both profiles signed in to the same account with "Extensions" sync enabled (chrome://settings/syncSetup): yes / no
- Extension loaded in both profiles from the same build (commit hash): ____________
- Note: unpacked extensions may not sync `chrome.storage.sync` in all Chrome builds; record what you observe.
  If it does not sync for unpacked extensions, repeat with a packed/signed build and say so here: ____________

## Procedure
1. On profile A open the options page, add `example.com` to the whitelist (or use the popup toggle on example.com).
2. Note the time. On profile B open the options page and refresh every 30 s.
3. Record the time the entry appears. Repeat for removal.
4. Repeat with 3 entries added at once and with 1 entry removed.

## Results
| Step | Action on A (time) | Appeared/disappeared on B (time) | Elapsed | Within 5 min? | Notes |
|------|--------------------|----------------------------------|---------|---------------|-------|
| Add 1 entry | | | | | |
| Remove the entry | | | | | |
| Add 3 entries | | | | | |
| Remove 1 of 3 | | | | | |

Also confirm on profile B that blocking is actually disabled on a whitelisted domain after a page reload: yes / no

## Sign-off
- Criterion met: yes / no   Tester/date: ____________
