import type {RefObject} from 'react';
import type {VideoRef} from 'react-native-video';

export type HlsSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// Permissive error shape: react-native-video v6 reports onError with an
// object carrying `error.message`; older builds wrap it as `{error: {...}}`.
// The index signature (on the outer type AND on the nested `error` shape,
// which would otherwise be a weak type with no overlap with v6's
// `error.errorString`/`error.localizedDescription`/etc.) makes this a
// supertype of either, so the handler type-checks against v6's exact
// `onError` param without coupling to it.
export type HlsErrorEvent = {
  error?: {message?: string; [key: string]: unknown};
  message?: string;
  [key: string]: unknown;
};

export type UseHlsSessionResult = {
  status: HlsSessionStatus;
  errorMessage: string | null;
  playerRef: RefObject<VideoRef | null>;
  onLoad: () => void;
  onError: (event: HlsErrorEvent) => void;
  start: () => void;
  stop: () => void;
};
