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
  const renderItem = ({item}: {item: LauncherFeature}) => {
    const disabled = item.disabled === true;
    return (
      <View
        testID="launcher-card"
        style={[styles.card, {borderColor: item.color}, disabled && styles.cardDisabled]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{item.title}</Text>
          {disabled && (
            <Text testID={`launcher-${item.id}-disabled`} style={styles.disabledBadge}>
              Disabled
            </Text>
          )}
        </View>
        <Text style={styles.description}>{item.description}</Text>
        {disabled && item.disabledReason && (
          <Text testID={`launcher-${item.id}-reason`} style={styles.disabledReason}>
            {item.disabledReason}
          </Text>
        )}
        <Button
          testID={`launcher-${item.id}-action`}
          title={item.actionLabel}
          disabled={disabled}
          onPress={() => {
            if (disabled) {
              return;
            }
            navigation.navigate(item.destination);
          }}
        />
      </View>
    );
  };
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
  cardDisabled: {opacity: 0.5},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  title: {fontSize: 16, fontWeight: '700'},
  description: {fontSize: 14, color: '#444'},
  disabledBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#999',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  disabledReason: {fontSize: 12, color: '#900'},
});
