import type {RefObject} from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';

export type SrtSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// libVLC's onError event payload is {target: number} with no message field.
// The hook ignores the payload and shows a generic 'Playback error'. The
// index signature keeps the type permissive for any extra native fields.
export type SrtErrorEvent = {
  target?: number;
  [key: string]: unknown;
};

export type UseSrtSessionResult = {
  status: SrtSessionStatus;
  errorMessage: string | null;
  playerRef: RefObject<VLCPlayer | null>;
  onPlaying: () => void;
  onError: (event: SrtErrorEvent) => void;
  start: () => void;
  stop: () => void;
};
