import {DEFAULT_DASH_URL, validateDashUrl} from '../features/dash/validation';

describe('validateDashUrl', () => {
  it('rejects empty input', () => {
    expect(validateDashUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateDashUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateDashUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects non-http(s) schemes', () => {
    expect(validateDashUrl('ftp://host/x')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('rejects the srt scheme', () => {
    expect(validateDashUrl('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('accepts DEFAULT_DASH_URL', () => {
    expect(validateDashUrl(DEFAULT_DASH_URL)).toEqual({ok: true, url: DEFAULT_DASH_URL});
  });
  it('accepts a valid https DASH URL', () => {
    expect(validateDashUrl('https://example.com/live/stream.mpd')).toEqual({
      ok: true,
      url: 'https://example.com/live/stream.mpd',
    });
  });
  it('accepts a valid DASH URL without a .mpd suffix', () => {
    expect(validateDashUrl('http://example.com/live/stream')).toEqual({
      ok: true,
      url: 'http://example.com/live/stream',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateDashUrl('  https://example.com/live/stream.mpd  ')).toEqual({
      ok: true,
      url: 'https://example.com/live/stream.mpd',
    });
  });
  it('DEFAULT_DASH_URL is the SRS DASH endpoint', () => {
    expect(DEFAULT_DASH_URL).toBe('http://192.168.1.100:8080/live/livestream.mpd');
  });
  it('does not collide with the HLS default', () => {
    expect(DEFAULT_DASH_URL).not.toBe('http://192.168.1.100:8080/live/livestream.m3u8');
  });
});
