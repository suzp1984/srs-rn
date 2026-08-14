import type {RefObject} from 'react';
import type {RTMPPublisherRefProps} from 'react-native-rtmp-publisher';

export type RtmpPublisherStatus = 'idle' | 'starting' | 'active' | 'error';

// The library's onConnectionFailed/onConnectionStarted callbacks carry a
// string; onConnectionSuccess/onDisconnect carry null. These signatures match
// the package's shipped RTMPPublisherProps exactly so the handlers type-check
// when passed to <RTMPPublisher>.
export type UseRtmpPublisherSessionResult = {
  status: RtmpPublisherStatus;
  errorMessage: string | null;
  publisherRef: RefObject<RTMPPublisherRefProps | null>;
  onConnectionStarted: (data: string) => void;
  onConnectionSuccess: (data: null) => void;
  onConnectionFailed: (data: string) => void;
  onDisconnect: (data: null) => void;
  start: () => void;
  stop: () => void;
};
