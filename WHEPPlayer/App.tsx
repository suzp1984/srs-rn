/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import {
  Button,
  SafeAreaView,
  View
} from "react-native";
import {
  MediaStream, MediaStreamTrack, RTCPeerConnection, RTCSessionDescription, RTCView
} from "react-native-webrtc";

// See https://ossrs.io/lts/en-us/docs/v5/doc/webrtc#http-api
const WHEPUrl = 'http://192.168.1.100:1985/rtc/v1/whep/?app=live&stream=livestream';

// react-native-webrtc 124.0.7's public export does not surface the peer
// connection's inherited addEventListener overloads, its event map, or its
// RTCTrackEvent class. Describe locally only the two listener signatures
// App uses, built from the publicly-exported MediaStream/MediaStreamTrack
// types; keep the assertion narrow and reuse public runtime behavior.
type PCTrackEvent = {
  readonly track: MediaStreamTrack | null;
  readonly streams: MediaStream[];
};
type PCEventListener = {
  (type: 'iceconnectionstatechange', listener: (event: { readonly type: string }) => void): void;
  (type: 'track', listener: (event: PCTrackEvent) => void): void;
};
type PCWithListener = RTCPeerConnection & { addEventListener: PCEventListener };

function App(): React.JSX.Element {
  const [pc, setPC] = React.useState<RTCPeerConnection | null>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);

  const startPlaying = React.useCallback(async () => {
    const peerConnection = new RTCPeerConnection() as PCWithListener;
    console.log('peerConnection', peerConnection);
    setPC(peerConnection);

    // See https://github.com/react-native-webrtc/react-native-webrtc/blob/master/Documentation/BasicUsage.md#creating-a-peer-connection
    peerConnection.addEventListener('iceconnectionstatechange', (event) => {
      console.log(`event iceconnectionstatechange: ${JSON.stringify(event)}`);
    });

    peerConnection.addTransceiver('audio', { direction: 'recvonly' });
    peerConnection.addTransceiver('video', { direction: 'recvonly' });

    // To keep api consistent between player and publisher.
    // @see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addStream#Migrating_to_addTrack
    // @see https://webrtc.org/getting-started/media-devices
    const mediaStream = new MediaStream();
    // See https://github.com/react-native-webrtc/react-native-webrtc/blob/master/Documentation/BasicUsage.md#creating-a-peer-connection
    peerConnection.addEventListener('track', (event) => {
      console.log(`event track: streams=${event.streams.length}, track=${event.track?.id} ${event.track?.kind} ${event.track?.label}`);
      // The callback when got local stream.
      // @see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addStream#Migrating_to_addTrack
      if (event.track) {
        mediaStream.addTrack(event.track);
        setStream(mediaStream);
      }
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log(`offer ${offer.type} created, sdp: ${offer.sdp}`);

    const response = await fetch(
      WHEPUrl, {
        method: 'POST', headers: {'Content-Type': 'application/sdp'},
        body: offer.sdp,
      },
    );
    if (!response.ok) {
      console.error(`failed to publish: ${response.status} ${response.statusText}`);
      return;
    }

    const answerSDP = await response.text();
    console.log(`answer sdp: ${answerSDP}`);

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({type: 'answer', sdp: answerSDP})
    );
    console.log(`set answer sdp ok`);
  }, [setStream, setPC]);

  const stopPlaying = React.useCallback(async () => {
    if (pc) {
      pc.close();
      console.log(`pc closed`);
    }

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log(`track ${track.id} ${track.kind} stopped`);
      });
      console.log(`stream ${stream.id} closed`);
    }

    setStream(null);
    setPC(null);
  }, [stream, setStream, pc, setPC]);

  return (
    <SafeAreaView>
      <View>
        {!stream && <Button title='Start' onPress={startPlaying}></Button>}
        {stream && <Button title='Stop' onPress={stopPlaying}></Button>}
        {stream && <View style={{width: 300, height: 400, borderWidth: 1}}>
          <RTCView
            streamURL={stream.toURL()}
            objectFit="cover"
            style={{width: '100%', height: '100%'}}
          />
        </View>}
      </View>
    </SafeAreaView>
  );
}

export default App;
