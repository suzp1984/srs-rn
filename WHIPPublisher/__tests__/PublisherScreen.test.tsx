/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {it} from '@jest/globals';
import PublisherScreen from '../screens/PublisherScreen';
import {DEFAULT_WHIP_URL} from '../urlValidation';

it('renders PublisherScreen with a whipUrl route param', async () => {
  const route = {
    key: 'Publisher-test',
    name: 'Publisher' as const,
    params: {whipUrl: DEFAULT_WHIP_URL},
  };
  const navigation = {
    goBack: () => {},
    navigate: () => {},
    addListener: () => () => {},
  } as any;

  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <PublisherScreen route={route as any} navigation={navigation} />,
    );
  });
});
