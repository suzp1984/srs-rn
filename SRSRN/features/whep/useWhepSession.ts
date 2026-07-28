import React from 'react';
import {
  MediaStream,
  MediaStreamTrack,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import type {WhepSessionStatus} from './types';

// react-native-webrtc 124.0.7 does not surface the peer connection's
// addEventListener overloads or its RTCTrackEvent in public typings.
type PCTrackEvent = {
  readonly track: MediaStreamTrack | null;
  readonly streams: MediaStream[];
};
type PCEventListener = {
  (type: 'iceconnectionstatechange', listener: (event: {readonly type: string}) => void): void;
  (type: 'track', listener: (event: PCTrackEvent) => void): void;
};
type PCWithListener = RTCPeerConnection & {addEventListener: PCEventListener};

type Attempt = {
  id: number;
  pc: PCWithListener;
  stream: MediaStream;
  abort: AbortController;
  closed: boolean;
};

export function useWhepSession(whepUrl: string) {
  const [status, setStatus] = React.useState<WhepSessionStatus>('idle');
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const attemptRef = React.useRef<Attempt | null>(null);
  const counterRef = React.useRef(0);

  const isCurrent = React.useCallback(
    (attempt: Attempt) => attemptRef.current === attempt,
    [],
  );

  const cleanupAttempt = React.useCallback((attempt: Attempt | null) => {
    if (!attempt || attempt.closed) {
      return;
    }
    attempt.closed = true;
    try {
      attempt.abort.abort();
    } catch {
      // ignore
    }
    attempt.stream.getTracks().forEach(t => t.stop());
    attempt.pc.close();
  }, []);

  const stop = React.useCallback(() => {
    const attempt = attemptRef.current;
    if (attempt) {
      cleanupAttempt(attempt);
    }
    attemptRef.current = null;
    setStream(null);
    setErrorMessage(null);
    setStatus('idle');
  }, [cleanupAttempt]);

  const start = React.useCallback(async () => {
    if (attemptRef.current !== null) {
      return; // duplicate/concurrent Start guard
    }
    setErrorMessage(null);
    setStatus('starting');

    counterRef.current += 1;
    const pc = new RTCPeerConnection() as PCWithListener;
    const mediaStream = new MediaStream();
    const attempt: Attempt = {
      id: counterRef.current,
      pc,
      stream: mediaStream,
      abort: new AbortController(),
      closed: false,
    };
    attemptRef.current = attempt;

    try {
      pc.addEventListener('iceconnectionstatechange', () => {});
      pc.addTransceiver('audio', {direction: 'recvonly'});
      pc.addTransceiver('video', {direction: 'recvonly'});

      pc.addEventListener('track', event => {
        if (event.track) {
          mediaStream.addTrack(event.track);
          if (isCurrent(attempt)) {
            setStream(mediaStream);
          }
        }
      });

      const offer = await pc.createOffer();
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      await pc.setLocalDescription(offer);
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }

      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/sdp'},
        body: offer.sdp,
        signal: attempt.abort.signal,
      });
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      if (!response.ok) {
        throw new Error(`Server responded ${response.status} ${response.statusText}`);
      }

      const answerSDP = await response.text();
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      await pc.setRemoteDescription(
        new RTCSessionDescription({type: 'answer', sdp: answerSDP}),
      );
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      setStatus('active');
    } catch (err) {
      if (attemptRef.current === attempt) {
        cleanupAttempt(attempt);
        attemptRef.current = null;
        setStream(null);
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setStatus('error');
      } else {
        cleanupAttempt(attempt);
      }
    }
  }, [whepUrl, isCurrent, cleanupAttempt]);

  React.useEffect(() => {
    return () => {
      const attempt = attemptRef.current;
      if (attempt) {
        cleanupAttempt(attempt);
        attemptRef.current = null;
      }
    };
  }, [cleanupAttempt]);

  return {status, stream, errorMessage, start, stop};
}
