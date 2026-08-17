import {DEFAULT_FLV_URL, validateFlvUrl} from '../features/flv/validation';

describe('validateFlvUrl', () => {
  it('rejects empty input', () => {
    expect(validateFlvUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateFlvUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateFlvUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects the rtmp scheme', () => {
    expect(validateFlvUrl('rtmp://192.168.1.100:1935/live/livestream')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('rejects the srt scheme', () => {
    expect(validateFlvUrl('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('accepts DEFAULT_FLV_URL', () => {
    expect(validateFlvUrl(DEFAULT_FLV_URL)).toEqual({ok: true, url: DEFAULT_FLV_URL});
  });
  it('accepts an https URL', () => {
    expect(validateFlvUrl('https://example.com/live/livestream.flv')).toEqual({
      ok: true,
      url: 'https://example.com/live/livestream.flv',
    });
  });
  it('accepts an http URL with a different host', () => {
    expect(validateFlvUrl('http://10.0.0.5:8080/live/stream.flv')).toEqual({
      ok: true,
      url: 'http://10.0.0.5:8080/live/stream.flv',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateFlvUrl('  http://192.168.1.100:8080/live/livestream.flv  ')).toEqual({
      ok: true,
      url: 'http://192.168.1.100:8080/live/livestream.flv',
    });
  });
  it('DEFAULT_FLV_URL is the SRS HTTP-FLV play endpoint', () => {
    expect(DEFAULT_FLV_URL).toBe('http://192.168.1.100:8080/live/livestream.flv');
  });
});
