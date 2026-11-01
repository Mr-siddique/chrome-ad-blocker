# Blockers: human-only manual tasks (FIX iteration 1)

None of these can be done by code or the agents. They are NOT done; no result below is claimed.

## M1. AT-5 playback integrity (SPEC DoD)
1. `npm run build`; Chrome > chrome://extensions > Developer mode > Load unpacked > select `dist/`.
2. With ad-tier Prime Video and Jio Hotstar accounts, play 10 titles per platform for 10 minutes each (mix auto-play and manual play).
3. For each title record in `tests/manual/AT-5-playback-log.md`: ads seen, playback stalls, subtitles OK, controls OK (play/pause/seek/volume/fullscreen), rebuffer count.
4. Pass criteria are in SPEC AT-5. Any broken control or subtitle is a fail.

## M2. AT-17 real Chrome load
1. Load `dist/` as above. Confirm no errors on the extension card ("Errors" button absent) and in the service worker console (click "service worker").
2. Open the popup and options page; confirm no console errors.
3. Run `npm run validate` and the Chrome Web Store manifest check (note the new `declarativeNetRequestFeedback` permission needs the justification in `scripts/validate-manifest.js`).

## M3. Verify the new network-block counter in real Chrome (FIX 1)
1. Load `dist/` (packed or unpacked). Visit a page with known ad requests (e.g. a news site, then Prime Video/Hotstar with ads).
2. Open the popup: count, per-platform label and domain list should be non-zero and the badge should match; reload and confirm the count resets.
3. Check the service worker console for `getMatchedRules` errors (quota or permission). Record the result in `tests/manual/real-page-perf-log.md`.
4. Watch for double counting (a request blocked and its placeholder then removed from the DOM); record any observed.

## M4. Live-traffic corpus confirmation (AT-1/2/3/6)
1. With DevTools or a HAR export, capture ad traffic and DOM snapshots from ad-tier Prime Video and Hotstar sessions.
2. Replace the author-built corpus in `tests/fixtures/` with captured hosts/URLs, set `confirmed: true`, re-run `npm test`.
3. If any block rate is below 90%, expand `src/filters/*` rules or DOM selectors and rebuild rules with `npm run build:rules`.

## M5. Real-page performance and memory (AT-9/10/11, memory, rebuffer)
1. Chrome DevTools > Performance (or Lighthouse) on 50 streaming and 50 regular pages with and without the extension; record p95 added load time in `tests/manual/real-page-perf-log.md` (target < 50 ms).
2. chrome://serviceworker-internals or Task Manager: service worker memory after 1 hour (target <= 50 MB).
3. Streaming: rebuffer events and dropped frames (video "Stats for nerds"/`getVideoPlaybackQuality()`) on >= 10 titles per platform, with and without the extension.

## M6. Persistence and sync
1. Set whitelist/settings, fully quit and restart Chrome, confirm they persist (AT-14).
2. Sign in to two Chrome profiles with sync on; add a whitelist entry in one and confirm it appears in the other.

## M7. jsdom devDependency (process)
`package-lock.json` is root-owned and was not touched. A human should run `npm install --save-dev jsdom` (fix ownership first if needed) and commit `package.json` + lock.

## Known minor, not fixed
- Custom-pattern cap (1900 dynamic rules) is still silent in the options UI.
