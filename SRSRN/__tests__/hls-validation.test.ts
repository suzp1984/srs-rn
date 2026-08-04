import {DEFAULT_HLS_URL, validateHlsUrl} from '../features/hls/validation';

describe('validateHlsUrl', () => {
  it('rejects empty input', () => {
    expect(validateHlsUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateHlsUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateHlsUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects non-http(s) schemes', () => {
    expect(validateHlsUrl('ftp://host/x')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('accepts DEFAULT_HLS_URL', () => {
    expect(validateHlsUrl(DEFAULT_HLS_URL)).toEqual({ok: true, url: DEFAULT_HLS_URL});
  });
  it('accepts a valid https HLS URL', () => {
    expect(validateHlsUrl('https://example.com/live/stream.m3u8')).toEqual({
      ok: true,
      url: 'https://example.com/live/stream.m3u8',
    });
  });
  it('accepts a valid HLS URL without a .m3u8 suffix', () => {
    expect(validateHlsUrl('http://example.com/live/stream')).toEqual({
      ok: true,
      url: 'http://example.com/live/stream',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateHlsUrl('  https://example.com/live/stream.m3u8  ')).toEqual({
      ok: true,
      url: 'https://example.com/live/stream.m3u8',
    });
  });
  it('DEFAULT_HLS_URL is the SRS HLS endpoint', () => {
    expect(DEFAULT_HLS_URL).toBe('http://192.168.1.100:8080/live/livestream.m3u8');
  });
  it('does not collide with the WHEP default', () => {
    expect(DEFAULT_HLS_URL).not.toBe(
      'http://192.168.1.100:1985/rtc/v1/whep/?app=live&stream=livestream',
    );
  });
});
