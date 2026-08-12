import {DEFAULT_RTMP_URL, validateRtmpUrl} from '../features/rtmp/validation';

describe('validateRtmpUrl', () => {
  it('rejects empty input', () => {
    expect(validateRtmpUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateRtmpUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateRtmpUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects http(s) schemes', () => {
    expect(validateRtmpUrl('http://example.com/stream')).toEqual({
      ok: false,
      message: 'URL must start with rtmp://',
    });
  });
  it('rejects the srt scheme', () => {
    expect(validateRtmpUrl('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request')).toEqual({
      ok: false,
      message: 'URL must start with rtmp://',
    });
  });
  it('accepts DEFAULT_RTMP_URL', () => {
    expect(validateRtmpUrl(DEFAULT_RTMP_URL)).toEqual({ok: true, url: DEFAULT_RTMP_URL});
  });
  it('accepts a valid rtmp URL with a different host', () => {
    expect(validateRtmpUrl('rtmp://10.0.0.5:1935/live/stream')).toEqual({
      ok: true,
      url: 'rtmp://10.0.0.5:1935/live/stream',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateRtmpUrl('  rtmp://192.168.1.100:1935/live/livestream  ')).toEqual({
      ok: true,
      url: 'rtmp://192.168.1.100:1935/live/livestream',
    });
  });
  it('DEFAULT_RTMP_URL is the SRS RTMP play endpoint', () => {
    expect(DEFAULT_RTMP_URL).toBe('rtmp://192.168.1.100:1935/live/livestream');
  });
  it('does not collide with the SRT default', () => {
    expect(DEFAULT_RTMP_URL).not.toBe('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request');
  });
});
