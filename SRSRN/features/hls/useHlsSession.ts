import React from 'react';
import type {VideoRef} from 'react-native-video';
import type {HlsErrorEvent, HlsSessionStatus, UseHlsSessionResult} from './types';

type Attempt = {
  id: number;
  closed: boolean;
};

type Handlers = {
  onLoad: () => void;
  onError: (event: HlsErrorEvent) => void;
};

const noop = () => {};
const noopError = (_event: HlsErrorEvent) => {};

// Mirrors useWhepSession's structure (explicit Start, attemptRef + isCurrent
// guard, idempotent cleanupAttempt via a closed flag, unmount teardown) but
// adapted to a component-mounted react-native-video player. There is no
// PeerConnection, MediaStream, fetch, or AbortController: the player is
// released by unmounting <Video> (status -> 'idle'), and late onLoad/onError
// from an obsolete attempt are dropped by the isCurrent(attempt) guard
// captured in the per-attempt closures stored in `handlers` state.
export function useHlsSession(): UseHlsSessionResult {
  const [status, setStatus] = React.useState<HlsSessionStatus>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [handlers, setHandlers] = React.useState<Handlers | null>(null);

  const attemptRef = React.useRef<Attempt | null>(null);
  const counterRef = React.useRef(0);
  const playerRef = React.useRef<VideoRef>(null);

  const isCurrent = React.useCallback(
    (attempt: Attempt) => attemptRef.current === attempt,
    [],
  );

  const cleanupAttempt = React.useCallback((attempt: Attempt | null) => {
    if (!attempt || attempt.closed) {
      return;
    }
    attempt.closed = true;
    // No imperative ref.stop(): react-native-video v6 releases the player
    // when <Video> unmounts. The status -> 'idle' transition in stop() and
    // onError() performs that unmount; this closed flag plus isCurrent()
    // drops any late onLoad/onError from this attempt.
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

    // Per-attempt closures capture `attempt` so a stale attempt's late
    // onLoad/onError short-circuits via isCurrent(attempt).
    const attemptHandlers: Handlers = {
      onLoad: () => {
        if (!isCurrent(attempt)) {
          return;
        }
        setStatus('active');
      },
      onError: (event: HlsErrorEvent) => {
        if (!isCurrent(attempt)) {
          return;
        }
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setHandlers(null);
        setErrorMessage(event?.error?.message ?? event?.message ?? 'Playback error');
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
    onLoad: handlers?.onLoad ?? noop,
    onError: handlers?.onError ?? noopError,
    start,
    stop,
  };
}
