import type {MediaStream} from 'react-native-webrtc';

export type WhepSessionStatus = 'idle' | 'starting' | 'active' | 'error';

export type UseWhepSessionResult = {
  status: WhepSessionStatus;
  stream: MediaStream | null;
  errorMessage: string | null;
  start: () => void;
  stop: () => void;
};
