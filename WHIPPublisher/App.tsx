/**
 * WHIPPublisher — SRS WHIP client with editable server URL.
 */
import 'react-native-gesture-handler';
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import UrlEntryScreen from './screens/UrlEntryScreen';
import PublisherScreen from './screens/PublisherScreen';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="UrlEntry">
        <Stack.Screen
          name="UrlEntry"
          component={UrlEntryScreen}
          options={{title: 'WHIP URL'}}
        />
        <Stack.Screen
          name="Publisher"
          component={PublisherScreen}
          options={{title: 'Publisher'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
