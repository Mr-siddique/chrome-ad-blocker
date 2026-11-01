# AT-5 Manual Playback Integrity Log (Prime Video and Jio Hotstar)

**STATUS: NOT RUN.** This is a blank template. No result below has been collected. A human tester with
their own Prime Video and Jio Hotstar accounts must fill it in. Do not mark AT-5 as passed from automated tests.

## Pass criteria (SPEC AT-5)
- At least 10 titles on Prime Video and at least 10 on Jio Hotstar.
- Each title played for at least 10 minutes, with both auto-play and manual play, including pause/resume.
- For every title: 0 playback failures, subtitles work, controls (play/pause/seek/volume) work, and 0 rebuffer events caused by the extension.

## Setup
- Tester: ______________  Date: ____________
- Chrome version (must be >= 90): ____________  OS: ____________
- Extension build (git commit hash from `git rev-parse --short HEAD`): ____________
- Loaded unpacked from `dist/` after `npm run build`: yes / no
- Extension errors page (chrome://extensions > Errors) clear before starting: yes / no
- Service worker console clear before starting: yes / no
- Isolated Chrome profile used: yes / no
- Account tier (with ads / ad-free): ____________  (the ad-supported tier is required to see ads)

## Procedure per title
1. Open the title. Note whether an ad plays (pre-roll, mid-roll, bumper, overlay) and which ones the extension removed.
2. Auto-play session: let it run 10 minutes without touching it.
3. Manual-play session: press play, pause for 30 s, resume, seek forward and back once, change volume, toggle subtitles on and off.
4. Open and close the extension popup twice during playback; confirm no interruption.
5. Record rebuffer/black screen observations (Chrome `chrome://media-internals` or the player's stats overlay can help).
6. Compare against the same title with the extension disabled if any anomaly is seen.

## Prime Video (need >= 10)
| # | Title | Ad types seen | Ads removed by extension | Auto-play 10 min OK | Manual play OK | Pause/resume OK | Subtitles OK | Controls OK | Rebuffer events caused by extension | Black/blank > 500 ms | Notes |
|---|-------|---------------|--------------------------|---------------------|----------------|-----------------|--------------|-------------|--------------------------------------|----------------------|-------|
| 1 | | | | | | | | | | | |
| 2 | | | | | | | | | | | |
| 3 | | | | | | | | | | | |
| 4 | | | | | | | | | | | |
| 5 | | | | | | | | | | | |
| 6 | | | | | | | | | | | |
| 7 | | | | | | | | | | | |
| 8 | | | | | | | | | | | |
| 9 | | | | | | | | | | | |
| 10 | | | | | | | | | | | |

## Jio Hotstar (need >= 10)
| # | Title | Ad types seen | Ads removed by extension | Auto-play 10 min OK | Manual play OK | Pause/resume OK | Subtitles OK | Controls OK | Rebuffer events caused by extension | Black/blank > 500 ms | Notes |
|---|-------|---------------|--------------------------|---------------------|----------------|-----------------|--------------|-------------|--------------------------------------|----------------------|-------|
| 1 | | | | | | | | | | | |
| 2 | | | | | | | | | | | |
| 3 | | | | | | | | | | | |
| 4 | | | | | | | | | | | |
| 5 | | | | | | | | | | | |
| 6 | | | | | | | | | | | |
| 7 | | | | | | | | | | | |
| 8 | | | | | | | | | | | |
| 9 | | | | | | | | | | | |
| 10 | | | | | | | | | | | |

## Real block rate observed (needed because the committed corpus is unconfirmed)
Count every ad the platform served in the sessions above and how many the extension blocked or removed.
Server-side stitched ads that cannot be separated count in the denominator (SPEC edge cases).

| Platform | Ads served | Ads blocked/removed | Rate | Meets >= 90%? |
|----------|-----------:|--------------------:|-----:|---------------|
| Prime Video | | | | |
| Jio Hotstar | | | | |

## Live capture confirmation of corpus endpoints (planning assumption 4)
Capture traffic with DevTools Network (or a HAR export) during ad playback and fill in what was actually seen.
Entries in `src/filters/*.js` and `tests/fixtures/` are `confirmed: false` until confirmed here.
Do not paste account tokens, cookies or personal data; record hostnames and path prefixes only.

| Spec endpoint / pattern | Seen in live traffic? | Observed host and path prefix | Blocked by the extension? | Notes |
|-------------------------|-----------------------|-------------------------------|---------------------------|-------|
| `aiv-cdn.amazon.com/ads` | | | | |
| `ad-tier-*.prd.primevideo.*` | | | | |
| `ads.jiohotstar.com` | | | | |
| `cdn-*.hotstar.com/ads` | | | | |
| Other ad hosts observed but NOT in the bundled list | | | n/a | List them so they can be added in a release |
| Listed vendor hosts never observed (candidates for removal) | | | n/a | |

Player DOM class names or attributes seen on ad overlays (to replace the unverified guesses in `src/filters/*.js`):
____________________________________________________________

## Defects found
| ID | Platform/title | Description | Caused by extension? | Fixed in commit |
|----|----------------|-------------|----------------------|-----------------|

## Sign-off
- All rows complete and every criterion met: yes / no
- Tester signature/date: ____________
