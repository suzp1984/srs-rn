/**
 * @format
 */

import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

it('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
