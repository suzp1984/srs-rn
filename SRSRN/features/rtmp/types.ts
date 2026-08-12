import type {RefObject} from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';

export type RtmpSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// libVLC's onError event payload is {target: number} with no message field.
// The hook ignores the payload and shows a generic 'Playback error'. The
// index signature keeps the type permissive for any extra native fields.
export type RtmpErrorEvent = {
  target?: number;
  [key: string]: unknown;
};

export type UseRtmpSessionResult = {
  status: RtmpSessionStatus;
  errorMessage: string | null;
  playerRef: RefObject<VLCPlayer | null>;
  onPlaying: () => void;
  onError: (event: RtmpErrorEvent) => void;
  start: () => void;
  stop: () => void;
};
