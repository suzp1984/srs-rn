/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {HomeScreen} from '../screens/HomeScreen';
import {LAUNCHER_FEATURES, LauncherFeature} from '../launcher/features';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}

function render(features?: LauncherFeature[]) {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'Home-test', name: 'Home' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <HomeScreen navigation={navigation} route={route} features={features} />,
    );
  });
  return {tree, navigate};
}

describe('HomeScreen', () => {
  it('renders a card for each launcher feature from the default config', () => {
    const {tree} = render();
    expect(tree.root.findAllByProps({testID: 'launcher-whip-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-whep-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-hls-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-srt-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-dash-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-rtmp-action'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-rtmp_publish-action'}).length).toBeGreaterThan(0);
  });

  it('navigates to WhipUrl when the WHIP card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-whip-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('WhipUrl');
  });

  it('navigates to WhepUrl when the WHEP card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-whep-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('WhepUrl');
  });

  it('navigates to HlsUrl when the HLS card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-hls-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('HlsUrl');
  });

  it('does not navigate and shows a disabled badge for the SRT card', () => {
    const {tree, navigate} = render();
    // SRT is disabled in the launcher config: pressing its action must not
    // navigate, and a Disabled badge + reason must be rendered.
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-srt-action').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({testID: 'launcher-srt-disabled'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({testID: 'launcher-srt-reason'}).length).toBeGreaterThan(0);
  });

  it('navigates to DashUrl when the DASH card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-dash-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('DashUrl');
  });

  it('navigates to RtmpUrl when the RTMP card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-rtmp-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RtmpUrl');
  });

  it('navigates to RtmpPublishUrl when the RTMP Publish card action is pressed', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'launcher-rtmp_publish-action').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RtmpPublishUrl');
  });

  it('renders an additional launcher entry without layout changes', () => {
    const extra: LauncherFeature = {
      id: 'flv',
      title: 'HTTP-FLV Play',
      description: 'Future entry.',
      actionLabel: 'Open FLV',
      color: '#999',
      destination: 'WhipUrl',
    };
    const {tree} = render([...LAUNCHER_FEATURES, extra]);
    // Use an existence check, not an exact count: React 19's test renderer
    // represents forwardRef host components like View twice, doubling any
    // findAllByProps count on a View testID.
    expect(tree.root.findAllByProps({testID: 'launcher-flv-action'}).length).toBeGreaterThan(0);
  });
});
