/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {RtspUrlScreen} from '../features/rtsp/RtspUrlScreen';
import {DEFAULT_RTSP_URL} from '../features/rtsp/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'rtsp-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'RtspUrl-test', name: 'RtspUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<RtspUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('RtspUrlScreen', () => {
  it('prefills the input with DEFAULT_RTSP_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'rtsp-url-input').props.value).toBe(DEFAULT_RTSP_URL);
  });
  it('navigates to RtspPlayer with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RtspPlayer', {rtspUrl: DEFAULT_RTSP_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows the rtsps-specific error for an rtsps:// URL and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-input').props.onChangeText('rtsps://192.168.1.100:322/live/livestream');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(findByTestID(tree.root, 'rtsp-url-error').props.children).toBe('rtsps:// (RTSP over TLS) is not supported');
  });
  it('shows a path-required error for an rtsp URL with no path and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-input').props.onChangeText('rtsp://192.168.1.100:554');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtsp-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'rtsp-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('rtsp://10.0.0.5:554/live/stream');
    });
    expect(input.props.value).toBe('rtsp://10.0.0.5:554/live/stream');
  });
});
