export const DEFAULT_WHIP_URL =
  'http://192.168.1.100:1985/rtc/v1/whip/?app=live&stream=livestream';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateWhipUrl(input: string): ValidationResult {
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
