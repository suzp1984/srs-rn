import React from 'react';
import type {RTMPPublisherRefProps} from 'react-native-rtmp-publisher';
import type {
  RtmpPublisherStatus,
  UseRtmpPublisherSessionResult,
} from './types';

type Attempt = {
  id: number;
  closed: boolean;
};

type Handlers = {
  onConnectionStarted: (data: string) => void;
  onConnectionSuccess: (data: null) => void;
  onConnectionFailed: (data: string) => void;
  onDisconnect: (data: null) => void;
};

const noopString = (_data: string) => {};
const noopNull = (_data: null) => {};

// Mirrors useWhipSession (explicit Start, attemptRef + isCurrent guard,
// idempotent cleanupAttempt via a closed flag, unmount teardown) adapted to
// react-native-rtmp-publisher's <RTMPPublisher> component. The component is
// mounted on Start; startStream() is called from a useEffect once the ref is
// attached (React attaches refs during commit, before the effect runs). The
// connection callbacks (per-attempt, isCurrent-guarded) drive status.
// cleanupAttempt calls stopStream(); the closed flag plus isCurrent() drops
// any late callbacks from an obsolete attempt. Handler signatures match the
// package's shipped RTMPPublisherProps (onConnectionFailed/Started: string,
// onConnectionSuccess/Disconnect: null).
export function useRtmpPublisherSession(): UseRtmpPublisherSessionResult {
  const [status, setStatus] = React.useState<RtmpPublisherStatus>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [handlers, setHandlers] = React.useState<Handlers | null>(null);

  const attemptRef = React.useRef<Attempt | null>(null);
  const counterRef = React.useRef(0);
  const publisherRef = React.useRef<RTMPPublisherRefProps>(null);

  const isCurrent = React.useCallback(
    (attempt: Attempt) => attemptRef.current === attempt,
    [],
  );

  const cleanupAttempt = React.useCallback((attempt: Attempt | null) => {
    if (!attempt || attempt.closed) {
      return;
    }
    attempt.closed = true;
    // Imperative stop: stopStream() ends the RTMP push. The subsequent
    // status -> 'idle' transition in stop()/onConnectionFailed() unmounts
    // <RTMPPublisher>, releasing the camera/mic. isCurrent() drops any late
    // connection callbacks.
    publisherRef.current?.stopStream();
  }, []);

  const stop = React.useCallback(() => {
    const attempt = attemptRef.current;
    if (attempt) {
      cleanupAttempt(attempt);
    }
    attemptRef.current = null;
    setHandlers(null);
    setErrorMessage(null);
    setStatus('idle');
  }, [cleanupAttempt]);

  const start = React.useCallback(() => {
    if (attemptRef.current !== null) {
      return; // duplicate/concurrent Start guard
    }
    setErrorMessage(null);
    setStatus('starting');

    counterRef.current += 1;
    const attempt: Attempt = {
      id: counterRef.current,
      closed: false,
    };
    attemptRef.current = attempt;

    const attemptHandlers: Handlers = {
      onConnectionStarted: (_data: string) => {
        if (!isCurrent(attempt)) {
          return;
        }
        // stay 'starting' until success/failure
      },
      onConnectionSuccess: (_data: null) => {
        if (!isCurrent(attempt)) {
          return;
        }
        setStatus('active');
      },
      onConnectionFailed: (data: string) => {
        if (!isCurrent(attempt)) {
          return;
        }
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setHandlers(null);
        setErrorMessage(data || 'Connection failed');
        setStatus('error');
      },
      onDisconnect: (_data: null) => {
        if (!isCurrent(attempt)) {
          return;
        }
        // Unexpected disconnect (our own stop() nulls attemptRef first, so
        // this only fires for server-side drops while the attempt is current).
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setHandlers(null);
        setErrorMessage('Disconnected');
        setStatus('error');
      },
    };
    setHandlers(attemptHandlers);
  }, [isCurrent, cleanupAttempt]);

  // Call startStream() once <RTMPPublisher> has mounted and the ref attached.
  // React attaches refs during commit, before this effect runs, so
  // publisherRef.current is set when status first becomes 'starting'.
  React.useEffect(() => {
    if (status === 'starting' && publisherRef.current) {
      publisherRef.current.startStream();
    }
  }, [status]);

  React.useEffect(() => {
    return () => {
      const attempt = attemptRef.current;
      if (attempt) {
        cleanupAttempt(attempt);
        attemptRef.current = null;
      }
    };
  }, [cleanupAttempt]);

  return {
    status,
    errorMessage,
    publisherRef,
    onConnectionStarted: handlers?.onConnectionStarted ?? noopString,
    onConnectionSuccess: handlers?.onConnectionSuccess ?? noopNull,
    onConnectionFailed: handlers?.onConnectionFailed ?? noopString,
    onDisconnect: handlers?.onDisconnect ?? noopNull,
    start,
    stop,
  };
}
