export const DEFAULT_RTMP_URL =
  'rtmp://192.168.1.100:1935/live/livestream';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateRtmpUrl(input: string): ValidationResult {
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
  if (parsed.protocol !== 'rtmp:') {
    return {ok: false, message: 'URL must start with rtmp://'};
  }
  return {ok: true, url: trimmed};
}
