import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {VLCPlayer} from 'react-native-vlc-media-player';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useFlvSession} from './useFlvSession';

type Props = NativeStackScreenProps<RootStackParamList, 'FlvPlayer'>;

export function FlvPlayerScreen({route}: Props): React.JSX.Element {
  const {flvUrl} = route.params;
  const {status, errorMessage, playerRef, onPlaying, onError, start, stop} = useFlvSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="flv-player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="flv-player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="flv-player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View style={styles.videoContainer}>
          <VLCPlayer
            testID="flv-video"
            ref={playerRef}
            source={{uri: flvUrl}}
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
