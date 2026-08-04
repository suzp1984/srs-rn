export const DEFAULT_HLS_URL =
  'http://192.168.1.100:8080/live/livestream.m3u8';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateHlsUrl(input: string): ValidationResult {
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
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {ok: false, message: 'URL must start with http:// or https://'};
  }
  return {ok: true, url: trimmed};
}
