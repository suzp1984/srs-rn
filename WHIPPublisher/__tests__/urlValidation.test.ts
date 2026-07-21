import {DEFAULT_WHIP_URL, validateWhipUrl} from '../urlValidation';

describe('validateWhipUrl', () => {
  it('rejects empty input', () => {
    expect(validateWhipUrl('')).toEqual({
      ok: false,
      message: 'Please enter a URL',
    });
  });

  it('rejects whitespace-only input', () => {
    expect(validateWhipUrl('   ')).toEqual({
      ok: false,
      message: 'Please enter a URL',
    });
  });

  it('rejects an unparseable string', () => {
    expect(validateWhipUrl('not a url')).toEqual({
      ok: false,
      message: 'Please enter a valid URL',
    });
  });

  it('rejects non-http(s) schemes', () => {
    expect(validateWhipUrl('ftp://host/x')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });

  it('accepts DEFAULT_WHIP_URL', () => {
    expect(validateWhipUrl(DEFAULT_WHIP_URL)).toEqual({
      ok: true,
      url: DEFAULT_WHIP_URL,
    });
  });

  it('accepts a valid https URL', () => {
    expect(validateWhipUrl('https://example.com/whip')).toEqual({
      ok: true,
      url: 'https://example.com/whip',
    });
  });

  it('trims whitespace before validating', () => {
    expect(validateWhipUrl('  https://example.com/whip  ')).toEqual({
      ok: true,
      url: 'https://example.com/whip',
    });
  });

  it('DEFAULT_WHIP_URL matches the previously hardcoded value byte-for-byte', () => {
    expect(DEFAULT_WHIP_URL).toBe(
      'http://192.168.1.100:1985/rtc/v1/whip/?app=live&stream=livestream',
    );
  });
});
