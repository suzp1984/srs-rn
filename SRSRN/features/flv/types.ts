import type {RefObject} from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';

export type FlvSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// libVLC's onError event payload is {target: number} with no message field.
// The hook ignores the payload and shows a generic 'Playback error'. The
// index signature keeps the type permissive for any extra native fields.
export type FlvErrorEvent = {
  target?: number;
  [key: string]: unknown;
};

export type UseFlvSessionResult = {
  status: FlvSessionStatus;
  errorMessage: string | null;
  playerRef: RefObject<VLCPlayer | null>;
  onPlaying: () => void;
  onError: (event: FlvErrorEvent) => void;
  start: () => void;
  stop: () => void;
};
