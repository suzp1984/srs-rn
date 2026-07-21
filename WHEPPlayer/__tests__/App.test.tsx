/**
 * @format
 */

jest.mock('react-native-gesture-handler', () => ({}));
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}) => children,
  createNavigationContainerRef: () => ({current: null}),
}));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children}) => children,
    Screen: () => null,
  }),
}));
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

it('renders the UrlEntry screen as the initial route', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
