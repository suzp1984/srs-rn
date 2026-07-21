/**
 * @format
 */

import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {it} from '@jest/globals';

import PlayerScreen from '../screens/PlayerScreen';
import {DEFAULT_WHEP_URL} from '../urlValidation';

it('PlayerScreen renders with a whepUrl route param', async () => {
  const navigation = {goBack: () => {}} as never;
  const route = {
    key: 'Player-test',
    name: 'Player' as const,
    params: {whepUrl: DEFAULT_WHEP_URL},
  } as never;
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<PlayerScreen navigation={navigation} route={route} />);
  });
});
