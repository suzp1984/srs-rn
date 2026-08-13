/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {RtmpPublishUrlScreen} from '../features/rtmp_publish/RtmpPublishUrlScreen';
import {DEFAULT_RTMP_PUBLISH_URL} from '../features/rtmp_publish/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'rtmp-publish-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'RtmpPublishUrl-test', name: 'RtmpPublishUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<RtmpPublishUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('RtmpPublishUrlScreen', () => {
  it('prefills the input with DEFAULT_RTMP_PUBLISH_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'rtmp-publish-url-input').props.value).toBe(DEFAULT_RTMP_PUBLISH_URL);
  });
  it('navigates to RtmpPublisher with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtmp-publish-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('RtmpPublisher', {rtmpUrl: DEFAULT_RTMP_PUBLISH_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtmp-publish-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtmp-publish-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows an error for http URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtmp-publish-url-input').props.onChangeText('http://example.com/stream');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'rtmp-publish-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'rtmp-publish-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('rtmp://10.0.0.5:1935/live/stream');
    });
    expect(input.props.value).toBe('rtmp://10.0.0.5:1935/live/stream');
  });
});
