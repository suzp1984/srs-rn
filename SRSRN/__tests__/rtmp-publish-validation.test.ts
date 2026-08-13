import {DEFAULT_RTMP_PUBLISH_URL, validateRtmpPublishUrl} from '../features/rtmp_publish/validation';

describe('validateRtmpPublishUrl', () => {
  it('rejects empty input', () => {
    expect(validateRtmpPublishUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateRtmpPublishUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateRtmpPublishUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects http(s) schemes', () => {
    expect(validateRtmpPublishUrl('http://example.com/stream')).toEqual({
      ok: false,
      message: 'URL must start with rtmp://',
    });
  });
  it('rejects the srt scheme', () => {
    expect(validateRtmpPublishUrl('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request')).toEqual({
      ok: false,
      message: 'URL must start with rtmp://',
    });
  });
  it('accepts DEFAULT_RTMP_PUBLISH_URL', () => {
    expect(validateRtmpPublishUrl(DEFAULT_RTMP_PUBLISH_URL)).toEqual({ok: true, url: DEFAULT_RTMP_PUBLISH_URL});
  });
  it('accepts a valid rtmp URL with a different host', () => {
    expect(validateRtmpPublishUrl('rtmp://10.0.0.5:1935/live/stream')).toEqual({
      ok: true,
      url: 'rtmp://10.0.0.5:1935/live/stream',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateRtmpPublishUrl('  rtmp://192.168.1.100:1935/live/livestream  ')).toEqual({
      ok: true,
      url: 'rtmp://192.168.1.100:1935/live/livestream',
    });
  });
  it('DEFAULT_RTMP_PUBLISH_URL is the SRS RTMP ingest endpoint', () => {
    expect(DEFAULT_RTMP_PUBLISH_URL).toBe('rtmp://192.168.1.100:1935/live/livestream');
  });
});
