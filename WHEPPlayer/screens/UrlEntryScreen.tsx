import React from 'react';
import {Button, SafeAreaView, StyleSheet, Text, TextInput, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {DEFAULT_WHEP_URL, validateWhepUrl} from '../urlValidation';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'UrlEntry'>;

function UrlEntryScreen({navigation}: Props): React.JSX.Element {
  const [url, setUrl] = React.useState<string>(DEFAULT_WHEP_URL);
  const [error, setError] = React.useState<string | null>(null);

  const onConnect = React.useCallback(() => {
    const result = validateWhepUrl(url);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    navigation.navigate('Player', {whepUrl: result.url});
  }, [navigation, url]);

  return (
    <SafeAreaView>
      <View style={styles.container}>
        <Text style={styles.label}>WHEP URL</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="url"
          style={styles.input}
          testID="whep-url-input"
        />
        {error !== null && (
          <Text style={styles.error} testID="whep-url-error">
            {error}
          </Text>
        )}
        <Button title="Connect" onPress={onConnect} testID="whep-url-connect" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16},
  label: {fontSize: 14, marginBottom: 4},
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  error: {color: '#c00', marginBottom: 8},
});

export default UrlEntryScreen;
