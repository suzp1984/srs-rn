import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {VLCPlayer} from 'react-native-vlc-media-player';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useRtmpSession} from './useRtmpSession';

type Props = NativeStackScreenProps<RootStackParamList, 'RtmpPlayer'>;

export function RtmpPlayerScreen({route}: Props): React.JSX.Element {
  const {rtmpUrl} = route.params;
  const {status, errorMessage, playerRef, onPlaying, onError, start, stop} = useRtmpSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="rtmp-player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="rtmp-player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="rtmp-player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View style={styles.videoContainer}>
          <VLCPlayer
            testID="rtmp-video"
            ref={playerRef}
            source={{uri: rtmpUrl}}
            autoplay
            paused={false}
            resizeMode="contain"
            onPlaying={onPlaying}
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
