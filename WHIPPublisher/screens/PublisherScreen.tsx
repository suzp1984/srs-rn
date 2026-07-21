import React from 'react';
import {Button, StyleSheet, View} from 'react-native';
import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types';

// react-native-webrtc 124.0.7's public export does not surface the peer
// connection's inherited addEventListener overloads or its event map/track
// event types. Describe locally only the listener signature this screen
// uses; keep the assertion narrow and reuse public runtime behavior.
type PCEventListener = (
  type: 'iceconnectionstatechange',
  listener: (event: {readonly type: string}) => void,
) => void;
type PCWithListener = RTCPeerConnection & {addEventListener: PCEventListener};

type Props = NativeStackScreenProps<RootStackParamList, 'Publisher'>;

export default function PublisherScreen({route}: Props): React.JSX.Element {
  const {whipUrl} = route.params;
  const [pc, setPC] = React.useState<RTCPeerConnection | null>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  React.useEffect(() => {
    pcRef.current = pc;
  }, [pc]);
  React.useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const startPublishing = React.useCallback(async () => {
    const peerConnection = new RTCPeerConnection() as PCWithListener;
    console.log('peerConnection', peerConnection);
    setPC(peerConnection);

    peerConnection.addEventListener('iceconnectionstatechange', event => {
      console.log(`event iceconnectionstatechange: ${JSON.stringify(event)}`);
    });

    peerConnection.addTransceiver('audio', {direction: 'sendonly'});
    peerConnection.addTransceiver('video', {direction: 'sendonly'});

    const mediaStream = await mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    console.log(
      `localStream ${mediaStream.id} created, url: ${mediaStream.toURL()}`,
    );
    setStream(mediaStream);

    mediaStream.getTracks().forEach(track => {
      peerConnection.addTrack(track);
      console.log(`track ${track.id} ${track.kind} added to pc`);
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log(`offer ${offer.type} created, sdp: ${offer.sdp}`);

    const response = await fetch(whipUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/sdp'},
      body: offer.sdp,
    });
    if (!response.ok) {
      console.error(
        `failed to publish: ${response.status} ${response.statusText}`,
      );
      return;
    }

    const answerSDP = await response.text();
    console.log(`answer sdp: ${answerSDP}`);

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({type: 'answer', sdp: answerSDP}),
    );
    console.log('set answer sdp ok');
  }, [whipUrl]);

  const stopPublishing = React.useCallback(() => {
    const currentPC = pcRef.current;
    const currentStream = streamRef.current;
    if (currentPC) {
      currentPC.close();
      console.log('pc closed');
    }
    if (currentStream) {
      currentStream.getTracks().forEach(track => {
        track.stop();
        console.log(`track ${track.id} ${track.kind} stopped`);
      });
      console.log(`stream ${currentStream.id} closed`);
    }
    pcRef.current = null;
    streamRef.current = null;
    setStream(null);
    setPC(null);
  }, []);

  React.useEffect(() => {
    return () => {
      // Teardown on unmount — covers back gesture, hardware back, and Stop.
      const currentPC = pcRef.current;
      const currentStream = streamRef.current;
      if (currentPC) {
        currentPC.close();
      }
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      pcRef.current = null;
      streamRef.current = null;
    };
  }, []);

  return (
    <View style={styles.container}>
      {!stream && <Button title="Start" onPress={startPublishing} />}
      {stream && <Button title="Stop" onPress={stopPublishing} />}
      {stream && (
        <View style={styles.videoContainer}>
          <RTCView
            streamURL={stream.toURL()}
            objectFit="cover"
            style={styles.video}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, gap: 12},
  videoContainer: {width: 300, height: 400, borderWidth: 1},
  video: {width: '100%', height: '100%'},
});
