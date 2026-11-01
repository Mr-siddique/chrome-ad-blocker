import { hostToRegExp, parsePattern, validatePattern } from '../../src/utils/patterns.js';

describe('validatePattern', () => {
  it.each([
    ['ads.example.com'],
    ['||ads.example.com^'.replace('^', '')],
    ['https://ads.example.com/ads'],
    ['ad-tier-*.prd.primevideo.*'],
    ['cdn-*.hotstar.com/ads'],
  ])('accepts %s', (pattern) => {
    expect(validatePattern(pattern)).toEqual({ valid: true, error: null });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    [null, 'empty'],
    [undefined, 'empty'],
    ['*', 'two'],
    ['**', 'valid'],
    ['*.*', 'broad'],
    ['*.com', 'broad'],
    ['a.*', 'broad'],
    ['localhost', 'two'],
    ['ads example.com', 'spaces'],
    ['ads..example.com', 'non-empty'],
    ['/ads', 'host'],
    ['bad!host.com', 'invalid'],
    ['ads.example.com/a b', 'spaces'],
    ['ads.example.com/ads?x=<', 'Path'],
    ['a'.repeat(201) + '.com', 'long'],
  ])('rejects %p', (pattern) => {
    const result = validatePattern(pattern);
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

describe('parsePattern', () => {
  it('splits host and path and strips scheme and ||', () => {
    expect(parsePattern('https://Ads.Example.com/Ads')).toEqual({ host: 'ads.example.com', path: '/ads' });
    expect(parsePattern('||ads.example.com')).toEqual({ host: 'ads.example.com', path: '' });
  });

  it('returns null for non strings', () => {
    expect(parsePattern(42)).toBeNull();
  });
});

describe('hostToRegExp', () => {
  const regex = hostToRegExp('ad-tier-*.prd.primevideo.*');

  it('matches wildcard labels and TLD wildcards', () => {
    expect(regex.test('ad-tier-12.prd.primevideo.com')).toBe(true);
    expect(regex.test('ad-tier-eu.prd.primevideo.co.uk')).toBe(true);
    expect(regex.test('x.ad-tier-1.prd.primevideo.de')).toBe(true);
  });

  it('does not match lookalikes', () => {
    expect(regex.test('ad-tier-1.prd.primevideo.com.evil')).toBe(false);
    expect(regex.test('ad-tier-.prd.primevideo.com')).toBe(false);
    expect(regex.test('ad-tier-1.prd.primevideo')).toBe(false);
    expect(regex.test('evilad-tier-1.prd.primevideo.com')).toBe(false);
  });

  it('treats dots literally', () => {
    expect(hostToRegExp('ads.example.com').test('adsXexample.com')).toBe(false);
  });
});
