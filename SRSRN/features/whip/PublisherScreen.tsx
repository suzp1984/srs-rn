import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {RTCView} from 'react-native-webrtc';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useWhipSession} from './useWhipSession';

type Props = NativeStackScreenProps<RootStackParamList, 'Publisher'>;

export function PublisherScreen({route}: Props): React.JSX.Element {
  const {whipUrl} = route.params;
  const {status, stream, errorMessage, start, stop} = useWhipSession(whipUrl);
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="publisher-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="publisher-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="publisher-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {stream !== null && (
        <View style={styles.videoContainer}>
          <RTCView
            testID="publisher-video"
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
  error: {color: '#c00', fontSize: 13},
});
