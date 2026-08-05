import type {RefObject} from 'react';
import type {VideoRef} from 'react-native-video';

export type HlsSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// Permissive error shape that is a genuine supertype of react-native-video
// v6's `OnVideoErrorData`. v6's `error` object carries `errorString`,
// `localizedDescription`, `error`, `code`, `domain`, etc. - it has NO
// `message` field, so a hook that only reads `error.message` always falls
// through to a generic fallback in production. The named optionals below
// mirror v6's real fields so the extraction type-checks without casts; the
// outer and inner index signatures preserve supertype status for any extra
// fields v6 may add (and tolerate the test mock's simplified `{message}`
// shape on the stale-attempt path, which is short-circuited by isCurrent
// before any field is read).
export type HlsErrorEvent = {
  error?: {
    errorString?: string;
    localizedDescription?: string;
    error?: string;
    message?: string;
    [key: string]: unknown;
  };
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
