import { MAX_IMPORT_BYTES, parseImport, ruleSetsEqual, serializeExport } from '../../src/utils/import-export.js';

const ruleSet = {
  customPatterns: ['ads.example.com', 'cdn-*.example.com/ads'],
  whitelist: ['good.com', 'also-good.org'],
  blacklist: ['bad.net'],
  categories: { images: true, scripts: false, iframes: true },
};

const file = (overrides) => JSON.stringify({ format: 'streaming-ad-blocker-rules', version: 1, ...ruleSet, ...overrides });

describe('export and import round trip', () => {
  it('yields an identical rule set', () => {
    const result = parseImport(serializeExport(ruleSet));
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(0);
    expect(ruleSetsEqual(result.ruleSet, ruleSet)).toBe(true);
    expect(result.ruleSet).toEqual(ruleSet);
  });

  it('round-trips an empty rule set', () => {
    const empty = { customPatterns: [], whitelist: [], blacklist: [], categories: { images: true, scripts: true, iframes: true } };
    expect(parseImport(serializeExport(empty)).ruleSet).toEqual(empty);
  });

  it('is stable when exported again after import', () => {
    const once = parseImport(serializeExport(ruleSet)).ruleSet;
    expect(serializeExport(once)).toBe(serializeExport(ruleSet));
  });
});

describe('malformed imports are rejected', () => {
  it.each([
    ['', 'Nothing to import'],
    ['   ', 'Nothing to import'],
    [null, 'Nothing to import'],
    ['{not json', 'not valid JSON'],
    ['[1,2,3]', 'wrong structure'],
    ['null', 'wrong structure'],
    ['{"format":"other","version":1}', 'not a Streaming Ad Blocker export'],
    [JSON.stringify({ format: 'streaming-ad-blocker-rules', version: 2 }), 'Unsupported export version'],
    [JSON.stringify({ format: 'streaming-ad-blocker-rules', version: 1, customPatterns: 'x' }), 'missing required lists'],
    [file({ customPatterns: undefined }), 'missing required lists'],
    [file({ categories: 'nope' }), 'missing required lists'],
    [file({ whitelist: Array.from({ length: 2001 }, (_, i) => `d${i}.com`) }), 'too many entries'],
    ['x'.repeat(MAX_IMPORT_BYTES + 1), 'too large'],
  ])('rejects %p', (text, message) => {
    const result = parseImport(text);
    expect(result.ok).toBe(false);
    expect(result.error).toContain(message);
  });
});

describe('invalid entries are skipped and counted', () => {
  it('skips bad patterns, domains and category values', () => {
    const result = parseImport(file({
      customPatterns: ['ads.example.com', '*', '', 5, 'ads.example.com', 'bad pattern!'],
      whitelist: ['good.com', 'localhost', null],
      categories: { images: 'yes', scripts: false },
    }));
    expect(result.ok).toBe(true);
    expect(result.ruleSet.customPatterns).toEqual(['ads.example.com']);
    expect(result.ruleSet.whitelist).toEqual(['good.com']);
    expect(result.ruleSet.categories).toEqual({ images: true, scripts: false, iframes: true });
    expect(result.skipped).toBe(8);
  });

  it('normalizes entries and removes duplicates', () => {
    const result = parseImport(file({ customPatterns: ['HTTPS://Ads.Example.com/', 'ads.example.com/'], whitelist: ['Good.COM', 'good.com'] }));
    expect(result.ruleSet.whitelist).toEqual(['good.com']);
    expect(result.ruleSet.customPatterns).toEqual(['ads.example.com/']);
  });
});
