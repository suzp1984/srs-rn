import React from 'react';
import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import type {WhipSessionStatus} from './types';

// react-native-webrtc 124.0.7's public typings do not surface the peer
// connection's inherited addEventListener overloads. Describe only the
// listener signature this hook uses; keep the assertion narrow.
type PCEventListener = (
  type: 'iceconnectionstatechange',
  listener: (event: {readonly type: string}) => void,
) => void;
type PCWithListener = RTCPeerConnection & {addEventListener: PCEventListener};

type Attempt = {
  id: number;
  pc: PCWithListener;
  stream: MediaStream | null;
  abort: AbortController;
  closed: boolean;
};

export function useWhipSession(whipUrl: string) {
  const [status, setStatus] = React.useState<WhipSessionStatus>('idle');
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
      // AbortController.abort never throws; ignore defensively.
    }
    if (attempt.stream) {
      attempt.stream.getTracks().forEach(t => t.stop());
    }
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
    const attempt: Attempt = {
      id: counterRef.current,
      pc: new RTCPeerConnection() as PCWithListener,
      stream: null,
      abort: new AbortController(),
      closed: false,
    };
    attemptRef.current = attempt;

    try {
      attempt.pc.addEventListener('iceconnectionstatechange', () => {});
      attempt.pc.addTransceiver('audio', {direction: 'sendonly'});
      attempt.pc.addTransceiver('video', {direction: 'sendonly'});

      const mediaStream = await mediaDevices.getUserMedia({video: true, audio: true});
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      attempt.stream = mediaStream;
      mediaStream.getTracks().forEach(t => attempt.pc.addTrack(t));
      setStream(mediaStream);

      const offer = await attempt.pc.createOffer();
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }
      await attempt.pc.setLocalDescription(offer);
      if (!isCurrent(attempt)) {
        cleanupAttempt(attempt);
        return;
      }

      const response = await fetch(whipUrl, {
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
      await attempt.pc.setRemoteDescription(
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
        // Stale attempt: release its resources but do not touch current UI.
        cleanupAttempt(attempt);
      }
    }
  }, [whipUrl, isCurrent, cleanupAttempt]);

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
