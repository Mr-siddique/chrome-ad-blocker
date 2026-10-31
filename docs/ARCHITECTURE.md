# Architecture Guide

## System Design

The ad blocker uses a **Chrome MV3** architecture (manifest v3):

```
┌─────────────────────────────────────────────────────┐
│ User Interaction (Popup)                            │
│ ├─ Show blocked ad count                           │
│ ├─ Whitelist current domain                        │
│ └─ Open settings page                              │
└────────────────┬────────────────────────────────────┘
                 │
         (messages via chrome.runtime)
                 │
┌────────────────▼────────────────────────────────────┐
│ Service Worker (Background)                         │
│ ├─ Load filter rules on startup                    │
│ ├─ Track blocked ads                               │
│ ├─ Manage whitelist via storage.sync               │
│ └─ Receive/respond to popup messages               │
└────────────────┬────────────────────────────────────┘
                 │
         (injects content script)
                 │
┌────────────────▼────────────────────────────────────┐
│ Content Script (Every Page)                         │
│ ├─ Scan DOM for ad elements                        │
│ ├─ Block matched ads (hide via CSS)                │
│ ├─ Report stats to background                      │
│ └─ <50ms overhead per page (performance critical)  │
└─────────────────────────────────────────────────────┘
```

## Files & Responsibilities

### src/manifest.json
Chrome extension metadata:
```json
{
  "manifest_version": 3,
  "name": "Ad Blocker",
  "permissions": ["scripting", "storage"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

### src/background.js (Service Worker)
**Responsibilities:**
- Initialize filter rules from bundled list
- Listen for messages from content script
- Manage whitelist in chrome.storage.sync
- Respond to popup requests for stats

**Key Functions:**
```javascript
// Load filters on startup
initializeFilters()

// Message listener
chrome.runtime.onMessage.addListener((message, sender, send) => {
  if (message.type === 'GET_BLOCKED_ADS') {
    send(getBlockedStats());
  }
})

// Whitelist management
addToWhitelist(domain)
isWhitelisted(domain)
```

### src/content-script.js
**Responsibilities:**
- Scan current page for ad elements
- Block (hide) matched ads via CSS
- Track stats for this page
- Send report to background

**Key Functions:**
```javascript
// Main detection function
blockAds()

// Scan DOM for matching elements
detectAdElements(rootElement)

// Report to background
reportStats({ blockedCount, pageUrl })
```

### src/utils/filters.js
**Responsibilities:**
- Define ad detection patterns
- Export test-able filter functions
- Keep patterns up-to-date

**Key Functions:**
```javascript
// Check if single element is an ad
isAdElement(element)

// Get ads by domain/class/size
getAdsByDomain(elements)
getAdsByClass(elements)
getAdsBySize(elements)

// Main filter
filterAds(elements) // returns array of ad elements
```

### src/utils/storage.js
**Responsibilities:**
- Wrap chrome.storage API
- Provide Promise-based interface
- Handle errors gracefully

**Key Functions:**
```javascript
// Whitelist operations
getWhitelist()
addToWhitelist(domain)
removeFromWhitelist(domain)
isWhitelisted(domain)

// Stats operations
recordBlockedAds(count)
getBlockedStats()
```

### src/popup.html / popup.js
**UI Components:**
- Display blocked ad count
- Show domains blocked on this page
- Whitelist button
- Settings link

**Interactions:**
```javascript
// Get count from background
chrome.runtime.sendMessage({ type: 'GET_BLOCKED_ADS' }, (response) => {
  document.getElementById('count').innerText = response.count;
});

// Add to whitelist
document.getElementById('whitelist-btn').onclick = async () => {
  await addToWhitelist(currentDomain);
  showNotification('Domain whitelisted');
};
```

### tests/unit/filters.test.js
Unit tests for detection functions:
- Test each pattern individually
- Mock DOM elements
- Verify accuracy metrics

### tests/integration/blocker.test.js
Integration tests for end-to-end flow:
- Background loads filters
- Content script detects ads
- Popup shows correct count
- Whitelist updates storage

### tests/performance/benchmarks.js
Performance profiling:
- Measure filter matching time
- Measure content script overhead
- Compare to targets
- Generate report

## Data Flow

### Startup Sequence
```
1. Extension installed → Service worker starts
2. background.js runs chrome.runtime.onInstalled
3. initializeFilters() loads bundled filter list
4. Filter rules ready in memory
5. Content script injects on next page load
```

### Ad Blocking on Page Load
```
1. Page loads → Content script fires
2. blockAds() scans DOM
3. For each element:
   - Check if matches ad pattern
   - If match: add to blocked list, hide element
4. Report stats to background
5. Popup can display count
```

### Popup Interaction
```
1. User clicks extension icon
2. Popup.html loads
3. popup.js sends message to background
4. background.js responds with stats
5. popup.js displays count
6. User can click "Whitelist" → updates storage
7. Content script checks whitelist on next page load
```

## Performance Considerations

### Content Script <50ms Overhead
Why this matters:
- Content script runs on every page
- Must not delay page rendering
- Users will notice >50ms slowdown

Optimization tactics:
- Cache filter patterns (don't re-parse)
- Use efficient regex (compiled, not in loop)
- Batch DOM queries (don't querySelector in loop)
- Lazy whitelist loading (load only when needed)

### Filter Loading <200ms
Why this matters:
- Service worker loads filters on startup
- Delay affects extension load time
- Users might disable slow extensions

Optimization tactics:
- Store compiled patterns (not raw regex)
- Lazy load optional filters
- Cache in storage.local for next startup

## Testing Strategy

### Unit Tests (filters.js)
```
Test filter accuracy
├─ 100+ real ad domains → expect detected
├─ 1000+ legitimate domains → expect not detected
└─ Target: 95% accuracy, <2% false positive
```

### Integration Tests (blocker.test.js)
```
Test full workflow
├─ Background loads → filters ready
├─ Content script injects → detects ads
├─ Popup connects → gets stats
└─ Whitelist works → future pages skip ads
```

### Performance Tests (benchmarks.js)
```
Profile speed metrics
├─ Filter matching: <10ms per 100 elements
├─ Content script: <50ms total overhead
├─ Startup: <200ms to load filters
└─ Memory: <5MB for filter rules + stats
```

## Extension Permissions

```json
"permissions": [
  "scripting",  // Insert content script
  "storage"     // Access chrome.storage API
],
"host_permissions": [
  "<all_urls>"  // Run content script on all pages
]
```

Minimize permissions for privacy and security.

## Security Notes

1. **No eval()** - Don't use eval for dynamic filtering
2. **No inline scripts** - All script inline, not in HTML
3. **No background page** - MV3 uses service worker only
4. **Storage privacy** - Whitelist stored locally, not server
5. **No tracking** - Don't collect or send user data

## Future Enhancements (Out of Scope for MVP)

- [ ] Sync whitelist across devices (chrome.storage.sync)
- [ ] Auto-update filter list from cloud
- [ ] User-defined custom filters
- [ ] Statistics dashboard
- [ ] Dark mode for popup
- [ ] Keyboard shortcuts
- [ ] Context menu integration

---

For more details, see agent instructions in `agents/` directory.
