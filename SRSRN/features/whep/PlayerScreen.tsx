import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {RTCView} from 'react-native-webrtc';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useWhepSession} from './useWhepSession';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

export function PlayerScreen({route}: Props): React.JSX.Element {
  const {whepUrl} = route.params;
  const {status, stream, errorMessage, start, stop} = useWhepSession(whepUrl);
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {stream !== null && (
        <View style={styles.videoContainer}>
          <RTCView
            testID="player-video"
            streamURL={stream.toURL()}
            objectFit="contain"
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
