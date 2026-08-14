import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import RTMPPublisher from 'react-native-rtmp-publisher';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {useRtmpPublisherSession} from './useRtmpPublisherSession';

type Props = NativeStackScreenProps<RootStackParamList, 'RtmpPublisher'>;

// Split rtmp://host:port/app/stream into streamURL (before last '/') and
// streamName (last segment) for <RTMPPublisher>'s streamURL/streamName props.
function splitRtmpUrl(url: string): {streamURL: string; streamName: string} {
  const idx = url.lastIndexOf('/');
  if (idx <= 0) {
    return {streamURL: url, streamName: ''};
  }
  return {streamURL: url.slice(0, idx), streamName: url.slice(idx + 1)};
}

export function RtmpPublisherScreen({route}: Props): React.JSX.Element {
  const {rtmpUrl} = route.params;
  const {streamURL, streamName} = splitRtmpUrl(rtmpUrl);
  const {
    status,
    errorMessage,
    publisherRef,
    onConnectionStarted,
    onConnectionSuccess,
    onConnectionFailed,
    onDisconnect,
    start,
    stop,
  } = useRtmpPublisherSession();
  const idle = status === 'idle' || status === 'error';

  return (
    <View style={styles.container}>
      {idle && (
        <Button testID="rtmp-publisher-start" title="Start" onPress={start} />
      )}
      {!idle && (
        <Button testID="rtmp-publisher-stop" title="Stop" onPress={stop} />
      )}
      {errorMessage !== null && (
        <Text testID="rtmp-publisher-error" style={styles.error}>
          {errorMessage}
        </Text>
      )}
      {!idle && (
        <View testID="rtmp-publisher-preview" style={styles.previewContainer}>
          <RTMPPublisher
            ref={publisherRef}
            streamURL={streamURL}
            streamName={streamName}
            onConnectionStarted={onConnectionStarted}
            onConnectionSuccess={onConnectionSuccess}
            onConnectionFailed={onConnectionFailed}
            onDisconnect={onDisconnect}
            style={styles.preview}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, gap: 12},
  previewContainer: {width: 300, height: 400, borderWidth: 1},
  preview: {width: '100%', height: '100%'},
  error: {color: '#c00', fontSize: 13},
});
