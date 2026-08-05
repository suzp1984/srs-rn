import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import Video from 'react-native-video';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useHlsSession} from './useHlsSession';

type Props = NativeStackScreenProps<RootStackParamList, 'HlsPlayer'>;

export function HlsPlayerScreen({route}: Props): React.JSX.Element {
  const {hlsUrl} = route.params;
  const {status, errorMessage, playerRef, onLoad, onError, start, stop} = useHlsSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="hls-player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="hls-player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="hls-player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View style={styles.videoContainer}>
          <Video
            testID="hls-video"
            ref={playerRef}
            source={{uri: hlsUrl}}
            paused={false}
            resizeMode="contain"
            onLoad={onLoad}
            onError={onError}
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
