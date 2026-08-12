import React from 'react';
import type {VLCPlayer} from 'react-native-vlc-media-player';
import type {RtmpErrorEvent, RtmpSessionStatus, UseRtmpSessionResult} from './types';

type Attempt = {
  id: number;
  closed: boolean;
};

type Handlers = {
  onPlaying: () => void;
  onError: (event: RtmpErrorEvent) => void;
};

const noop = () => {};
const noopError = (_event: RtmpErrorEvent) => {};

// Mirrors useDashSession/useSrtSession (explicit Start, attemptRef + isCurrent
// guard, idempotent cleanupAttempt via a closed flag, unmount teardown) on the
// same libVLC media stack. Because VLCPlayer exposes an imperative
// stopPlayer() ref method, cleanupAttempt performs a TRUE imperative stop.
// There is no PeerConnection, MediaStream, fetch, or AbortController; libVLC
// performs the RTMP handshake and pulls the stream internally, and late
// onPlaying/onError from an obsolete attempt are dropped by the
// isCurrent(attempt) guard captured in the per-attempt closures stored in
// `handlers` state.
export function useRtmpSession(): UseRtmpSessionResult {
  const [status, setStatus] = React.useState<RtmpSessionStatus>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [handlers, setHandlers] = React.useState<Handlers | null>(null);

  const attemptRef = React.useRef<Attempt | null>(null);
  const counterRef = React.useRef(0);
  const playerRef = React.useRef<VLCPlayer>(null);

  const isCurrent = React.useCallback(
    (attempt: Attempt) => attemptRef.current === attempt,
    [],
  );

  const cleanupAttempt = React.useCallback((attempt: Attempt | null) => {
    if (!attempt || attempt.closed) {
      return;
    }
    attempt.closed = true;
    // True imperative stop: VLCPlayer exposes stopPlayer() (unlike
    // react-native-video v6). The subsequent status -> 'idle' transition in
    // stop()/onError() also unmounts <VLCPlayer>, releasing the native player;
    // this closed flag plus isCurrent() drops any late onPlaying/onError.
    playerRef.current?.stopPlayer();
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
      onPlaying: () => {
        if (!isCurrent(attempt)) {
          return;
        }
        setStatus('active');
      },
      onError: (_event: RtmpErrorEvent) => {
        if (!isCurrent(attempt)) {
          return;
        }
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setHandlers(null);
        // libVLC's onError carries only {target} with no message field, so a
        // generic message is the best user-visible text available.
        setErrorMessage('Playback error');
        setStatus('error');
      },
    };
    setHandlers(attemptHandlers);
  }, [isCurrent, cleanupAttempt]);

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
    playerRef,
    onPlaying: handlers?.onPlaying ?? noop,
    onError: handlers?.onError ?? noopError,
    start,
    stop,
  };
}
