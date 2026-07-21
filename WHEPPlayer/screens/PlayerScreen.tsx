import React from 'react';
import {Button, SafeAreaView, View} from 'react-native';
import {
  MediaStream,
  MediaStreamTrack,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

// See WHEPPlayer/App.tsx (pre-refactor) for the rationale behind this
// locally-declared listener type. react-native-webrtc 124.0.7 does not
// surface RTCPeerConnection's inherited addEventListener overloads or its
// RTCTrackEvent class in its public typings; this narrow assertion
// reuses the publicly-exported MediaStream / MediaStreamTrack types.
type PCTrackEvent = {
  readonly track: MediaStreamTrack | null;
  readonly streams: MediaStream[];
};
type PCEventListener = {
  (type: 'iceconnectionstatechange', listener: (event: {readonly type: string}) => void): void;
  (type: 'track', listener: (event: PCTrackEvent) => void): void;
};
type PCWithListener = RTCPeerConnection & {addEventListener: PCEventListener};

function PlayerScreen({navigation, route}: Props): React.JSX.Element {
  const {whepUrl} = route.params;
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const start = async () => {
      const peerConnection = new RTCPeerConnection() as PCWithListener;
      pcRef.current = peerConnection;
      console.log('peerConnection', peerConnection);

      peerConnection.addEventListener('iceconnectionstatechange', event => {
        console.log(`event iceconnectionstatechange: ${JSON.stringify(event)}`);
      });

      peerConnection.addTransceiver('audio', {direction: 'recvonly'});
      peerConnection.addTransceiver('video', {direction: 'recvonly'});

      const mediaStream = new MediaStream();
      streamRef.current = mediaStream;

      peerConnection.addEventListener('track', event => {
        console.log(
          `event track: streams=${event.streams.length}, track=${event.track?.id} ${event.track?.kind} ${event.track?.label}`,
        );
        if (event.track) {
          mediaStream.addTrack(event.track);
          if (!cancelled) {
            setStream(mediaStream);
          }
        }
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log(`offer ${offer.type} created, sdp: ${offer.sdp}`);

      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/sdp'},
        body: offer.sdp,
      });
      if (!response.ok) {
        console.error(`failed to publish: ${response.status} ${response.statusText}`);
        return;
      }
      if (cancelled) return;

      const answerSDP = await response.text();
      console.log(`answer sdp: ${answerSDP}`);
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({type: 'answer', sdp: answerSDP}),
      );
      console.log(`set answer sdp ok`);
    };

    start().catch(err => {
      console.error(`start failed: ${err}`);
    });

    return () => {
      cancelled = true;
      const pc = pcRef.current;
      const s = streamRef.current;
      if (pc) {
        pc.close();
        console.log('pc closed');
      }
      if (s) {
        s.getTracks().forEach(track => {
          track.stop();
          console.log(`track ${track.id} ${track.kind} stopped`);
        });
        console.log(`stream ${s.id} closed`);
      }
      pcRef.current = null;
      streamRef.current = null;
    };
  }, [whepUrl]);

  const onStop = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView>
      <View>
        <Button title="Stop" onPress={onStop} testID="player-stop" />
        {stream !== null && (
          <View style={{width: 300, height: 400, borderWidth: 1}}>
            <RTCView
              streamURL={stream.toURL()}
              objectFit="cover"
              style={{width: '100%', height: '100%'}}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export default PlayerScreen;
