export const DEFAULT_RTSP_URL =
  'rtsp://192.168.1.100:554/live/livestream';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

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
  if (!parsed.hostname) {
    return {ok: false, message: 'RTSP URL must include a host'};
  }
  if (!parsed.pathname) {
    return {ok: false, message: 'RTSP URL must include a path (e.g. /live/livestream)'};
  }
  return {ok: true, url: trimmed};
}
