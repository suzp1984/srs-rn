import {DEFAULT_SRT_URL, validateSrtUrl} from '../features/srt/validation';

describe('validateSrtUrl', () => {
  it('rejects empty input', () => {
    expect(validateSrtUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateSrtUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateSrtUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects http(s) schemes', () => {
    expect(validateSrtUrl('http://example.com/stream')).toEqual({
      ok: false,
      message: 'URL must start with srt://',
    });
  });
  it('rejects other non-srt schemes', () => {
    expect(validateSrtUrl('ftp://host/x')).toEqual({
      ok: false,
      message: 'URL must start with srt://',
    });
  });
  it('accepts DEFAULT_SRT_URL', () => {
    expect(validateSrtUrl(DEFAULT_SRT_URL)).toEqual({ok: true, url: DEFAULT_SRT_URL});
  });
  it('accepts a valid srt URL with a different host', () => {
    expect(validateSrtUrl('srt://10.0.0.5:10080?streamid=#!::r=live/stream,m=request')).toEqual({
      ok: true,
      url: 'srt://10.0.0.5:10080?streamid=#!::r=live/stream,m=request',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateSrtUrl('  srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request  ')).toEqual({
      ok: true,
      url: 'srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request',
    });
  });
  it('DEFAULT_SRT_URL is the SRS SRT play endpoint', () => {
    expect(DEFAULT_SRT_URL).toBe('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request');
  });
  it('does not collide with the HLS default', () => {
    expect(DEFAULT_SRT_URL).not.toBe('http://192.168.1.100:8080/live/livestream.m3u8');
  });
});
