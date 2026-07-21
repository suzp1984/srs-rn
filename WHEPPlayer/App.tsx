/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import 'react-native-gesture-handler';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import UrlEntryScreen from './screens/UrlEntryScreen';
import PlayerScreen from './screens/PlayerScreen';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="UrlEntry">
        <Stack.Screen
          name="UrlEntry"
          component={UrlEntryScreen}
          options={{title: 'WHEP URL'}}
        />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{title: 'Player'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
