import {DEFAULT_TS_URL, validateTsUrl} from '../features/ts/validation';

describe('validateTsUrl', () => {
  it('rejects empty input', () => {
    expect(validateTsUrl('')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects whitespace-only input', () => {
    expect(validateTsUrl('   ')).toEqual({ok: false, message: 'Please enter a URL'});
  });
  it('rejects an unparseable string', () => {
    expect(validateTsUrl('not a url')).toEqual({ok: false, message: 'Please enter a valid URL'});
  });
  it('rejects the rtmp scheme', () => {
    expect(validateTsUrl('rtmp://192.168.1.100:1935/live/livestream')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('rejects the srt scheme', () => {
    expect(validateTsUrl('srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request')).toEqual({
      ok: false,
      message: 'URL must start with http:// or https://',
    });
  });
  it('accepts DEFAULT_TS_URL', () => {
    expect(validateTsUrl(DEFAULT_TS_URL)).toEqual({ok: true, url: DEFAULT_TS_URL});
  });
  it('accepts an https URL', () => {
    expect(validateTsUrl('https://example.com/live/livestream.ts')).toEqual({
      ok: true,
      url: 'https://example.com/live/livestream.ts',
    });
  });
  it('accepts an http URL with a different host', () => {
    expect(validateTsUrl('http://10.0.0.5:8080/live/stream.ts')).toEqual({
      ok: true,
      url: 'http://10.0.0.5:8080/live/stream.ts',
    });
  });
  it('trims whitespace before validating', () => {
    expect(validateTsUrl('  http://192.168.1.100:8080/live/livestream.ts  ')).toEqual({
      ok: true,
      url: 'http://192.168.1.100:8080/live/livestream.ts',
    });
  });
  it('DEFAULT_TS_URL is the SRS HTTP-TS play endpoint', () => {
    expect(DEFAULT_TS_URL).toBe('http://192.168.1.100:8080/live/livestream.ts');
  });
});
