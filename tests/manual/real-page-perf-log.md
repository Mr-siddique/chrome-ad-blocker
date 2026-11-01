# Manual Real-Page Performance Log

**STATUS: NOT RUN.** Blank template. The automated benchmarks (`npm run benchmark`, `progress/perf-report.json`) are synthetic
(Node + jsdom) and do NOT replace these measurements. Source: SPEC Performance Targets and Detailed Requirement 6.

## Targets to verify on real pages
| Metric | Target | Method |
|--------|--------|--------|
| Content script overhead per page load | < 50 ms p95 | >= 50 loads with and without the extension on streaming pages and >= 50 on regular pages; report p95 of the difference |
| Streaming ad detection latency | < 100 ms p95 | >= 100 ad appearances on real playback; time from ad node/request appearing to blocked |
| Filter load on startup | < 200 ms p95 | >= 30 cold service-worker starts (DevTools > Service worker > stop, then trigger) |
| Playback impact | 0 extension-caused rebuffers; dropped frames +<= 1 percentage point | >= 10 titles per platform, extension on vs off |
| Service worker memory | <= 50 MB after 1 hour idle plus playback | Chrome Task Manager or DevTools memory snapshot |
| Storage access latency | < 20 ms p95 | >= 100 timed operations from the options page console |

## Setup
- Tester: ____________  Date: ____________  Chrome version: ______  Machine/OS: ____________
- Build commit hash: ____________  Network: ____________
- Methodology for "with vs without": same tab, cache disabled, alternate on/off, order randomized: yes / no

## 1. Page-load overhead (>= 50 loads each)
Use DevTools Performance panel or `performance.timing`/Navigation Timing (`loadEventEnd - startTime`). Record per-load values in the appendix or an attached CSV.

| Page group | Loads per condition | Median without (ms) | Median with (ms) | p95 of difference (ms) | < 50 ms? |
|------------|--------------------:|--------------------:|-----------------:|-----------------------:|----------|
| Prime Video | | | | | |
| Jio Hotstar | | | | | |
| Regular web pages | | | | | |

## 2. Ad detection latency (>= 100 per platform)
| Platform | Samples | p95 (ms) | < 100 ms? | How measured |
|----------|--------:|---------:|-----------|--------------|
| Prime Video | | | | |
| Jio Hotstar | | | | |

## 3. Filter load / cold start (>= 30)
| Samples | p95 (ms) | < 200 ms? | How measured |
|--------:|---------:|-----------|--------------|
| | | | |

## 4. Playback impact (>= 10 titles per platform, on vs off)
| Platform | Title | Rebuffers on | Rebuffers off | Dropped frames % on | Dropped frames % off | Delta (pp) | Meets target? |
|----------|-------|-------------:|--------------:|--------------------:|---------------------:|-----------:|---------------|
| | | | | | | | |

## 5. Service worker memory
| Time since start | Activity | Resident memory (MB) | <= 50 MB? |
|------------------|----------|---------------------:|-----------|
| 0 min | idle | | |
| 30 min | playback | | |
| 60 min | idle + playback | | |

## 6. Storage latency (>= 100 ops)
| Operation | Samples | p95 (ms) | < 20 ms? |
|-----------|--------:|---------:|----------|
| settings read | | | |
| settings write | | | |

## 7. Popup open/close during playback
Open and close the popup 10 times during playback on each platform. Interruptions observed: ____ Extra dropped frames: ____

## Sign-off
- All targets met: yes / no   Tester/date: ____________
