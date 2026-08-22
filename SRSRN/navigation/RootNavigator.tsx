import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from './types';
import {HomeScreen} from '../screens/HomeScreen';
import {WhipUrlScreen} from '../features/whip/WhipUrlScreen';
import {PublisherScreen} from '../features/whip/PublisherScreen';
import {WhepUrlScreen} from '../features/whep/WhepUrlScreen';
import {PlayerScreen} from '../features/whep/PlayerScreen';
import {HlsUrlScreen} from '../features/hls/HlsUrlScreen';
import {HlsPlayerScreen} from '../features/hls/HlsPlayerScreen';
import {SrtUrlScreen} from '../features/srt/SrtUrlScreen';
import {SrtPlayerScreen} from '../features/srt/SrtPlayerScreen';
import {DashUrlScreen} from '../features/dash/DashUrlScreen';
import {DashPlayerScreen} from '../features/dash/DashPlayerScreen';
import {RtmpUrlScreen} from '../features/rtmp/RtmpUrlScreen';
import {RtmpPlayerScreen} from '../features/rtmp/RtmpPlayerScreen';
import {RtmpPublishUrlScreen} from '../features/rtmp_publish/RtmpPublishUrlScreen';
import {RtmpPublisherScreen} from '../features/rtmp_publish/RtmpPublisherScreen';
import {FlvUrlScreen} from '../features/flv/FlvUrlScreen';
import {FlvPlayerScreen} from '../features/flv/FlvPlayerScreen';
import {TsUrlScreen} from '../features/ts/TsUrlScreen';
import {TsPlayerScreen} from '../features/ts/TsPlayerScreen';
import {RtspUrlScreen} from '../features/rtsp/RtspUrlScreen';
import {RtspPlayerScreen} from '../features/rtsp/RtspPlayerScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{title: 'SRS RN'}} />
        <Stack.Screen name="WhipUrl" component={WhipUrlScreen} options={{title: 'WHIP URL'}} />
        <Stack.Screen name="Publisher" component={PublisherScreen} options={{title: 'Publisher'}} />
        <Stack.Screen name="WhepUrl" component={WhepUrlScreen} options={{title: 'WHEP URL'}} />
        <Stack.Screen name="Player" component={PlayerScreen} options={{title: 'Player'}} />
        <Stack.Screen name="HlsUrl" component={HlsUrlScreen} options={{title: 'HLS URL'}} />
        <Stack.Screen name="HlsPlayer" component={HlsPlayerScreen} options={{title: 'HLS Player'}} />
        <Stack.Screen name="SrtUrl" component={SrtUrlScreen} options={{title: 'SRT URL'}} />
        <Stack.Screen name="SrtPlayer" component={SrtPlayerScreen} options={{title: 'SRT Player'}} />
        <Stack.Screen name="DashUrl" component={DashUrlScreen} options={{title: 'DASH URL'}} />
        <Stack.Screen name="DashPlayer" component={DashPlayerScreen} options={{title: 'DASH Player'}} />
        <Stack.Screen name="RtmpUrl" component={RtmpUrlScreen} options={{title: 'RTMP URL'}} />
        <Stack.Screen name="RtmpPlayer" component={RtmpPlayerScreen} options={{title: 'RTMP Player'}} />
        <Stack.Screen name="RtmpPublishUrl" component={RtmpPublishUrlScreen} options={{title: 'RTMP Publish URL'}} />
        <Stack.Screen name="RtmpPublisher" component={RtmpPublisherScreen} options={{title: 'RTMP Publisher'}} />
        <Stack.Screen name="FlvUrl" component={FlvUrlScreen} options={{title: 'HTTP-FLV URL'}} />
        <Stack.Screen name="FlvPlayer" component={FlvPlayerScreen} options={{title: 'HTTP-FLV Player'}} />
        <Stack.Screen name="TsUrl" component={TsUrlScreen} options={{title: 'HTTP-TS URL'}} />
        <Stack.Screen name="TsPlayer" component={TsPlayerScreen} options={{title: 'HTTP-TS Player'}} />
        <Stack.Screen name="RtspUrl" component={RtspUrlScreen} options={{title: 'RTSP URL'}} />
        <Stack.Screen name="RtspPlayer" component={RtspPlayerScreen} options={{title: 'RTSP Player'}} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
