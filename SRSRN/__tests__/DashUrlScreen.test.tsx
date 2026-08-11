/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {DashUrlScreen} from '../features/dash/DashUrlScreen';
import {DEFAULT_DASH_URL} from '../features/dash/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'dash-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'DashUrl-test', name: 'DashUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<DashUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('DashUrlScreen', () => {
  it('prefills the input with DEFAULT_DASH_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'dash-url-input').props.value).toBe(DEFAULT_DASH_URL);
  });
  it('navigates to DashPlayer with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'dash-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('DashPlayer', {dashUrl: DEFAULT_DASH_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'dash-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'dash-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows an error for srt URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'dash-url-input').props.onChangeText(
        'srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request',
      );
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'dash-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'dash-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('https://example.com/live/stream.mpd');
    });
    expect(input.props.value).toBe('https://example.com/live/stream.mpd');
  });
});
