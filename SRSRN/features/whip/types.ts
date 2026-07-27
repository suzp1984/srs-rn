import type {MediaStream} from 'react-native-webrtc';

export type WhipSessionStatus = 'idle' | 'starting' | 'active' | 'error';

export type UseWhipSessionResult = {
  status: WhipSessionStatus;
  stream: MediaStream | null;
  errorMessage: string | null;
  start: () => void;
  stop: () => void;
};
