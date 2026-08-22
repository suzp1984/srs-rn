import {DEFAULT_RTSP_URL, validateRtspUrl} from '../features/rtsp/validation';

describe('validateRtspUrl', () => {
  it('rejects empty input', () => {
    expect(validateRtspUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateRtspUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateRtspUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects http(s) schemes', () => {
    expect(validateRtspUrl('http://example.com/stream')).toEqual({
      ok: false,
      message: 'URL must start with rtsp://',
    });
  });
  it('rejects the rtmp scheme', () => {
    expect(validateRtspUrl('rtmp://192.168.1.100:1935/live/livestream')).toEqual({
      ok: false,
      message: 'URL must start with rtsp://',
    });
  });
  it('rejects the srt scheme', () => {
    expect(validateRtspUrl('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request')).toEqual({
      ok: false,
      message: 'URL must start with rtsp://',
    });
  });
  it('rejects rtsps:// (RTSP over TLS) with the specific message', () => {
    expect(validateRtspUrl('rtsps://192.168.1.100:322/live/livestream')).toEqual({
      ok: false,
      message: 'rtsps:// (RTSP over TLS) is not supported',
    });
  });
  it('rejects an rtsp URL with no path', () => {
    expect(validateRtspUrl('rtsp://192.168.1.100:554')).toEqual({
      ok: false,
      message: 'RTSP URL must include a path (e.g. /live/livestream)',
    });
  });
  it('accepts an rtsp URL with a bare-slash path', () => {
    expect(validateRtspUrl('rtsp://192.168.1.100:554/')).toEqual({
      ok: true,
      url: 'rtsp://192.168.1.100:554/',
    });
  });
  it('accepts DEFAULT_RTSP_URL', () => {
    expect(validateRtspUrl(DEFAULT_RTSP_URL)).toEqual({ok: true, url: DEFAULT_RTSP_URL});
  });
  it('accepts a valid rtsp URL with a different host', () => {
    expect(validateRtspUrl('rtsp://10.0.0.5:554/live/stream')).toEqual({
      ok: true,
      url: 'rtsp://10.0.0.5:554/live/stream',
    });
  });
  it('accepts an rtsp URL with URL-embedded credentials', () => {
    expect(validateRtspUrl('rtsp://user:pass@192.168.1.100:554/live/livestream')).toEqual({
      ok: true,
      url: 'rtsp://user:pass@192.168.1.100:554/live/livestream',
    });
  });
  it('accepts an rtsp URL with a query string', () => {
    expect(validateRtspUrl('rtsp://192.168.1.100:554/live/stream?param=value')).toEqual({
      ok: true,
      url: 'rtsp://192.168.1.100:554/live/stream?param=value',
    });
  });
  it('accepts an rtsp URL with uppercase scheme (case-insensitive)', () => {
    expect(validateRtspUrl('RTSP://192.168.1.100:554/live/livestream')).toEqual({
      ok: true,
      url: 'RTSP://192.168.1.100:554/live/livestream',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateRtspUrl('  rtsp://192.168.1.100:554/live/livestream  ')).toEqual({
      ok: true,
      url: 'rtsp://192.168.1.100:554/live/livestream',
    });
  });
  it('DEFAULT_RTSP_URL is the SRS RTSP play endpoint', () => {
    expect(DEFAULT_RTSP_URL).toBe('rtsp://192.168.1.100:554/live/livestream');
  });
  it('does not collide with the RTMP or TS defaults', () => {
    expect(DEFAULT_RTSP_URL).not.toBe('rtmp://192.168.1.100:1935/live/livestream');
    expect(DEFAULT_RTSP_URL).not.toBe('http://192.168.1.100:8080/live/livestream.ts');
  });
});
