import type {RefObject} from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';

export type DashSessionStatus = 'idle' | 'starting' | 'active' | 'error';

// libVLC's onError event payload is {target: number} with no message field.
// The hook ignores the payload and shows a generic 'Playback error'. The
// index signature keeps the type permissive for any extra native fields.
export type DashErrorEvent = {
  target?: number;
  [key: string]: unknown;
};

export type UseDashSessionResult = {
  status: DashSessionStatus;
  errorMessage: string | null;
  playerRef: RefObject<VLCPlayer | null>;
  onPlaying: () => void;
  onError: (event: DashErrorEvent) => void;
  start: () => void;
  stop: () => void;
};
