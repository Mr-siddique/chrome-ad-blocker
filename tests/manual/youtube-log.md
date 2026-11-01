# YouTube Manual Test Log (Amendment A1)

**STATUS: NOT RUN.** Blank template. YouTube support is best-effort and first-party; automated tests only cover fixtures. No numeric block-rate target is claimed. Do not mark AT-18..AT-21 verified from this file until a human fills it in.

## Setup
- Tester: ____________  Date: ____________  Chrome version (>= 111): ____________
- Build: `git rev-parse --short HEAD` = ____________; loaded unpacked from `dist/` after `npm run build`
- Signed in with Premium (must be NO, otherwise there are no ads): ____
- Other ad blockers disabled: yes / no

## Reload steps
1. `chrome://extensions` -> Reload the extension (check Errors is empty).
2. Open youtube.com in a fresh tab, hard refresh (Cmd+Shift+R).
3. Open DevTools Console on the page (filter errors) and the extension's service worker console.

## Scenarios (record Pass/Fail, ad type, URL, notes)
| # | Scenario | What to check | Result | URL / notes |
|---|----------|---------------|--------|-------------|
| 1 | Pre-roll, regular video | No ad, or ad skipped/fast-forwarded in about 1 s; video then plays from 0:00 | | |
| 2 | Mid-roll (long video, wait for ad break) | Same; content resumes at the correct position | | |
| 3 | Skippable ad that still appears | Skip is clicked automatically | | |
| 4 | Unskippable ad that still appears | Muted, fast-forwarded; volume and speed restored afterwards (check volume and 1x speed) | | |
| 5 | Live stream (with ads) | Stream keeps playing, no seeking jump, no freeze at live edge | | |
| 6 | Shorts | Scrolling works, no stuck/black player | | |
| 7 | Subtitles | CC button toggles, captions render and sync during and after ads | | |
| 8 | Controls | Play/pause, seek bar, volume, speed menu, fullscreen, theater all respond | | |
| 9 | Home / search / sidebar | Banner and in-feed ad slots hidden, no blank layout holes breaking the page | | |
| 10 | User-muted video | Stays muted after an ad | | |
| 11 | Whitelist youtube.com in popup, reload | Ads are not touched (stripping off after first response) | | |
| 12 | Popup/badge | Badge counts, popup shows "Blocked N YouTube ads" | | |

## If something fails, capture
- Console errors from the YouTube page and from the extension service worker (`chrome://extensions` -> service worker).
- Whether the ad was pre-roll or mid-roll, skippable or not, and the video URL.
- Whether YouTube showed an "ad blockers violate YouTube's Terms" or playback-blocked overlay.
- `dist/manifest.json` version and `git rev-parse --short HEAD`.
