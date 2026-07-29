import React from 'react';
import {Button, StyleSheet, Text, View, FlatList} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {LAUNCHER_FEATURES, type LauncherFeature} from '../launcher/features';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'> & {
  features?: LauncherFeature[];
};

export function HomeScreen({navigation, features}: Props): React.JSX.Element {
  const list = features ?? LAUNCHER_FEATURES;
  const renderItem = ({item}: {item: LauncherFeature}) => (
    <View
      testID="launcher-card"
      style={[styles.card, {borderColor: item.color}]}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
      <Button
        testID={`launcher-${item.id}-action`}
        title={item.actionLabel}
        onPress={() => navigation.navigate(item.destination)}
      />
    </View>
  );
  return (
    <View style={styles.container}>
      <FlatList
        data={list}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        numColumns={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16},
  card: {flex: 1, borderWidth: 2, borderRadius: 8, padding: 12, marginBottom: 12, gap: 8},
  title: {fontSize: 16, fontWeight: '700'},
  description: {fontSize: 14, color: '#444'},
});
