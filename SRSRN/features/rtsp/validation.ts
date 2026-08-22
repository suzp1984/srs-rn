export const DEFAULT_RTSP_URL =
  'rtsp://192.168.1.100:554/live/livestream';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

// Hermes (React Native's JS engine) has a known issue with non-special
// URL schemes (e.g. `rtsp:`): the WHATWG `URL` parser can return an empty
// `hostname` for valid RTSP URLs, so `new URL('rtsp://host:port/path')`
// ends up looking like the input had no host. V8 in Node is fine; this
// shows up on iPhone/Android builds. We use a small regex-based parser as
// a fallback whenever the standard parser reports an empty hostname or
// pathname for an `rtsp:` URL.
//
// The regex matches `rtsp://[user[:pass]@]host[:port][/path][?query][#fragment]`,
// case-insensitive. Host is either a non-special-char run or a bracketed
// IPv6 literal.
const RTSP_URL_PATTERN =
  /^rtsp:\/\/(?:[^@/?#\s]+@)?([^:/?#\s]+|\[[^\]]+\])(?::\d+)?(\/[^?#\s]*)?(?:\?[^#\s]*)?(?:#.*)?$/i;

// Exported for direct testing of the fallback path (V8 won't exercise it
// because V8 parses `rtsp:` correctly; Hermes does not).
export function parseRtspUrlManually(
  input: string,
): {host: string; path: string} | null {
  const match = RTSP_URL_PATTERN.exec(input);
  if (!match) {
    return null;
  }
  return {host: match[1], path: match[2] ?? ''};
}

export function validateRtspUrl(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {ok: false, message: 'Please enter a URL'};
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {ok: false, message: 'Please enter a valid URL'};
  }
  if (parsed.protocol === 'rtsps:') {
    return {ok: false, message: 'rtsps:// (RTSP over TLS) is not supported'};
  }
  if (parsed.protocol !== 'rtsp:') {
    return {ok: false, message: 'URL must start with rtsp://'};
  }
  // The standard parser's hostname/pathname can be empty for `rtsp:` URLs
  // under Hermes. Fall back to the manual parser in that case.
  const manual = parseRtspUrlManually(trimmed);
  const host = parsed.hostname || manual?.host || '';
  const path = parsed.pathname || manual?.path || '';
  if (!host) {
    return {ok: false, message: 'RTSP URL must include a host'};
  }
  if (!path) {
    return {ok: false, message: 'RTSP URL must include a path (e.g. /live/livestream)'};
  }
  return {ok: true, url: trimmed};
}
