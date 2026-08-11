import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {VLCPlayer} from 'react-native-vlc-media-player';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useDashSession} from './useDashSession';

type Props = NativeStackScreenProps<RootStackParamList, 'DashPlayer'>;

export function DashPlayerScreen({route}: Props): React.JSX.Element {
  const {dashUrl} = route.params;
  const {status, errorMessage, playerRef, onPlaying, onError, start, stop} = useDashSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="dash-player-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="dash-player-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="dash-player-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View style={styles.videoContainer}>
          <VLCPlayer
            testID="dash-video"
            ref={playerRef}
            source={{uri: dashUrl}}
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
