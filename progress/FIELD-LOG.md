# Field Log

Real-site evidence from the human running the built extension. Newest at the bottom.
Format: date | platform | build commit | result (blocked / escaped / breakage / noise) | captures.

## Captures So Far
- (pre-loop) YouTube | build 800bb03 | escaped: extension had no YouTube support; only doubleclick/googlesyndication trackers and ad_status.js blocked (`ERR_BLOCKED_BY_CLIENT`). Other blocker not ruled out.
- (pre-loop) Hotstar | build 800bb03 | escaped: ad stream `https://hesads.akamaized.net/ns/.../master.m3u8` loaded and played; only trackers blocked (twitter uwt.js, bing bat.js, doubleclick collect/trackimp/activity/viewthroughconversion). Host `hesads.akamaized.net` is absent from rules and corpus. Fix deferred by human.
