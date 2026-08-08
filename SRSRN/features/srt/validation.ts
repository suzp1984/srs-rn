export const DEFAULT_SRT_URL =
  'srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request';

export type ValidationResult =
  | {ok: true; url: string}
  | {ok: false; message: string};

export function validateSrtUrl(input: string): ValidationResult {
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
  if (parsed.protocol !== 'srt:') {
    return {ok: false, message: 'URL must start with srt://'};
  }
  return {ok: true, url: trimmed};
}
