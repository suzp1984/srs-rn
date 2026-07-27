import {DEFAULT_WHEP_URL, validateWhepUrl} from '../features/whep/validation';

describe('validateWhepUrl', () => {
  it('rejects empty input', () => {
    expect(validateWhepUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateWhepUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateWhepUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects non-http(s) schemes', () => {
    expect(validateWhepUrl('ftp://host/x')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('accepts DEFAULT_WHEP_URL', () => {
    expect(validateWhepUrl(DEFAULT_WHEP_URL)).toEqual({ok: true, url: DEFAULT_WHEP_URL});
  });
  it('accepts a valid https URL', () => {
    expect(validateWhepUrl('https://example.com/whep')).toEqual({
      ok: true,
      url: 'https://example.com/whep',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateWhepUrl('  https://example.com/whep  ')).toEqual({
      ok: true,
      url: 'https://example.com/whep',
    });
  });
  it('DEFAULT_WHEP_URL matches the legacy value byte-for-byte', () => {
    expect(DEFAULT_WHEP_URL).toBe(
      'http://192.168.1.100:1985/rtc/v1/whep/?app=live&stream=livestream',
    );
  });
  it('does not collide with the WHIP default', () => {
    expect(DEFAULT_WHEP_URL).not.toBe(
      'http://192.168.1.100:1985/rtc/v1/whip/?app=live&stream=livestream',
    );
  });
});
