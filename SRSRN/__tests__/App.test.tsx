/**
 * @format
 */
jest.mock('react-native-gesture-handler', () => ({}));
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}: {children: React.ReactNode}) => children,
  createNavigationContainerRef: () => ({current: null}),
}));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children}: {children: React.ReactNode}) => children,
    Screen: () => null,
  }),
}));
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {it} from '@jest/globals';
import App from '../App';

it('renders without crashing with Home as the initial route', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
