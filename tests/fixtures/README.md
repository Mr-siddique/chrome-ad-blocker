# Test Fixtures and Corpus Format

All corpora are committed so block-rate results are reproducible.

## Honesty rules
- Every corpus file has a `meta` block with `version`, `confirmed` and `source`.
- `confirmed: false` means the entries were authored from the spec and public ad-tech knowledge
  and have NOT been validated against live Prime Video / Jio Hotstar traffic captures.
  A pass on an unconfirmed corpus is not evidence of a real-world block rate.
- Per-item `confidence`: `spec` (named in SPEC.md), `vendor-known` (a real ad-tech domain, but its
  use on the platform is unverified), `synthetic` (author-built test shape).
- Items flagged `stitched: true` model server-side stitched ads that cannot be separated at request
  level. They count in the denominator and are expected to be unblocked by URL rules.

## Layout
- `prime-video/endpoints.json`, `prime-video/dom/*.html`
- `jio-hotstar/endpoints.json`, `jio-hotstar/dom/*.html`
- `vast-vpaid/<platform>/{vast,vpaid}/*.json`
- `general/domains.json`, `general/dom/*.html`
- `clean/domains.json`, `clean/streaming-dom/*.html`

## Versioning
Bump `meta.version` (semver) whenever a corpus changes and note it in progress/REASONING.md.

## Endpoint item shape
`{ "id": "pv-e-001", "url": "https://...", "kind": "preroll|midroll|bumper|overlay|other",
   "stitched": false, "confidence": "vendor-known" }`
