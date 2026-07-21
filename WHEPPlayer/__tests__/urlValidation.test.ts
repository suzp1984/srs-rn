import {DEFAULT_WHEP_URL, validateWhepUrl} from '../urlValidation';

describe('validateWhepUrl', () => {
  it('rejects an empty string', () => {
    expect(validateWhepUrl('')).toEqual({
      ok: false,
      message: 'Please enter a URL',
    });
  });

  it('rejects whitespace-only input', () => {
    expect(validateWhepUrl('   ')).toEqual({
      ok: false,
      message: 'Please enter a URL',
    });
  });

  it('rejects a non-URL string', () => {
    expect(validateWhepUrl('not a url')).toEqual({
      ok: false,
      message: 'Please enter a valid URL',
    });
  });

  it('rejects a non-http(s) scheme', () => {
    expect(validateWhepUrl('ftp://host/x')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });

  it('accepts the default WHEP URL', () => {
    expect(validateWhepUrl(DEFAULT_WHEP_URL)).toEqual({
      ok: true,
      url: DEFAULT_WHEP_URL,
    });
  });

  it('accepts a plain https URL', () => {
    expect(validateWhepUrl('https://example.com/whep')).toEqual({
      ok: true,
      url: 'https://example.com/whep',
    });
  });

  it('trims surrounding whitespace on success', () => {
    expect(validateWhepUrl('  https://example.com/whep  ')).toEqual({
      ok: true,
      url: 'https://example.com/whep',
    });
  });

  it('exports the exact hardcoded default URL', () => {
    expect(DEFAULT_WHEP_URL).toBe(
      'http://192.168.1.100:1985/rtc/v1/whep/?app=live&stream=livestream',
    );
  });
});