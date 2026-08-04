import React from 'react';
import {Button, StyleSheet, Text, TextInput, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/types';
import {DEFAULT_HLS_URL, validateHlsUrl} from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'HlsUrl'>;

export function HlsUrlScreen({navigation}: Props): React.JSX.Element {
  const [url, setUrl] = React.useState<string>(DEFAULT_HLS_URL);
  const [error, setError] = React.useState<string | null>(null);

  const onConnect = React.useCallback(() => {
    const result = validateHlsUrl(url);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    navigation.navigate('HlsPlayer', {hlsUrl: result.url});
  }, [url, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>HLS server URL</Text>
      <TextInput
        testID="hls-url-input"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        style={styles.input}
      />
      {error !== null && (
        <Text testID="hls-url-error" style={styles.error}>
          {error}
        </Text>
      )}
      <Button testID="hls-url-connect" title="Connect" onPress={onConnect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, gap: 12},
  label: {fontSize: 14, fontWeight: '600'},
  input: {borderWidth: 1, borderColor: '#888', borderRadius: 4, padding: 8, fontSize: 14},
  error: {color: '#c00', fontSize: 13},
});
